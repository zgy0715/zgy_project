"""Graph node definitions - each agent as a workflow node."""

import logging
from typing import Any

from app.agents.base import BaseAgent
from app.agents.coder import CoderAgent
from app.agents.deployer import DeployerAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.tester import TesterAgent
from app.graph.state import WorkflowState

logger = logging.getLogger(__name__)

# Memoized agent instances, one per agent type. Building an agent creates a
# fresh LLMService (and thus an AsyncOpenAI client) that is never closed, so
# agents are constructed lazily once and reused across node invocations.
_agent_singletons: dict[str, BaseAgent] = {}

_AGENT_FACTORIES: dict[str, tuple[str, type[BaseAgent]]] = {
    "coder": ("workflow-coder", CoderAgent),
    "reviewer": ("workflow-reviewer", ReviewerAgent),
    "tester": ("workflow-tester", TesterAgent),
    "deployer": ("workflow-deployer", DeployerAgent),
}


def _get_agent(agent_type: str) -> BaseAgent:
    """Return the memoized agent instance for the given agent type.

    The instance is created lazily on first use and reused afterwards, so
    one LLM client is built per agent type instead of one per node call.
    Per-run agent state (artifacts/thinking_steps) is reset by
    ``BaseAgent.run()``, so reuse does not leak state between runs.

    Args:
        agent_type: One of "coder", "reviewer", "tester", "deployer".

    Returns:
        The shared agent instance for that type.

    Raises:
        ValueError: If the agent type is unknown.
    """
    if agent_type not in _agent_singletons:
        if agent_type not in _AGENT_FACTORIES:
            raise ValueError(f"Unknown agent type: {agent_type}")
        agent_name, factory = _AGENT_FACTORIES[agent_type]
        _agent_singletons[agent_type] = factory(name=agent_name)
        logger.info("Created singleton agent %s (%s)", agent_name, agent_type)
    return _agent_singletons[agent_type]


async def coder_node(state: WorkflowState) -> dict[str, Any]:
    """Execute the Coder agent node in the workflow.

    Args:
        state: Current workflow state.

    Returns:
        State updates from the coder agent execution.
    """
    logger.info("Executing Coder node for task: %s", state.get("task", ""))

    agent = _get_agent("coder")

    # Build context with downstream outputs from previous agents
    context = dict(state.get("context", {}))
    if state.get("review_output"):
        context["review_feedback"] = state["review_output"]

    result = await agent.run(
        task=state.get("task", ""),
        context=context,
    )

    # NOTE: `iteration` counts node executions (not coder retries); the retry
    # bound in app/graph/edges.py relies on this exact increment.
    return {
        "current_agent": "coder",
        "code_output": result,
        "iteration": state.get("iteration", 0) + 1,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "coder", "content": result}
        ],
        "thinking_steps": state.get("thinking_steps", []) + agent.thinking_steps,
    }


async def reviewer_node(state: WorkflowState) -> dict[str, Any]:
    """Execute the Reviewer agent node in the workflow.

    Args:
        state: Current workflow state.

    Returns:
        State updates from the reviewer agent execution.
    """
    logger.info("Executing Reviewer node")

    code_output = state.get("code_output", "")
    agent = _get_agent("reviewer")

    # Pass code_output as context for the reviewer
    context = dict(state.get("context", {}))
    context["code"] = code_output

    result = await agent.run(
        task=f"Review the following code:\n{code_output}",
        context=context,
    )

    return {
        "current_agent": "reviewer",
        "review_output": result,
        "iteration": state.get("iteration", 0) + 1,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "reviewer", "content": result}
        ],
        "thinking_steps": state.get("thinking_steps", []) + agent.thinking_steps,
    }


async def tester_node(state: WorkflowState) -> dict[str, Any]:
    """Execute the Tester agent node in the workflow.

    Args:
        state: Current workflow state.

    Returns:
        State updates from the tester agent execution.
    """
    logger.info("Executing Tester node")

    code_output = state.get("code_output", "")
    agent = _get_agent("tester")

    # Pass code_output and review_output as context for the tester
    context = dict(state.get("context", {}))
    context["code"] = code_output
    if state.get("review_output"):
        context["review_feedback"] = state["review_output"]

    result = await agent.run(
        task=f"Generate tests for the following code:\n{code_output}",
        context=context,
    )

    return {
        "current_agent": "tester",
        "test_output": result,
        "iteration": state.get("iteration", 0) + 1,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "tester", "content": result}
        ],
        "thinking_steps": state.get("thinking_steps", []) + agent.thinking_steps,
    }


async def deployer_node(state: WorkflowState) -> dict[str, Any]:
    """Execute the Deployer agent node in the workflow.

    Args:
        state: Current workflow state.

    Returns:
        State updates from the deployer agent execution.
    """
    logger.info("Executing Deployer node")

    code_output = state.get("code_output", "")
    agent = _get_agent("deployer")

    # Pass code_output and test_output as context for the deployer
    context = dict(state.get("context", {}))
    context["code"] = code_output
    if state.get("test_output"):
        context["test_output"] = state["test_output"]

    result = await agent.run(
        task=f"Generate deployment config for the following code:\n{code_output}",
        context=context,
    )

    return {
        "current_agent": "deployer",
        "deploy_output": result,
        "iteration": state.get("iteration", 0) + 1,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "deployer", "content": result}
        ],
        "thinking_steps": state.get("thinking_steps", []) + agent.thinking_steps,
    }


def create_agent_node(agent: BaseAgent) -> Any:
    """Create a workflow node function from an agent instance.

    Factory function that wraps a BaseAgent into a callable
    compatible with LangGraph's node interface.

    Args:
        agent: The agent instance to wrap as a node.

    Returns:
        An async function that executes the agent and returns state updates.
    """

    async def node_fn(state: WorkflowState) -> dict[str, Any]:
        """Execute the wrapped agent and return state updates."""
        logger.info("Executing %s node (%s)", agent.name, agent.agent_type.value)

        # Build context with downstream outputs from previous agents
        context = dict(state.get("context", {}))
        for key in ("code_output", "review_output", "test_output", "deploy_output"):
            if state.get(key):
                context[key] = state[key]

        result = await agent.run(
            task=state.get("task", ""),
            context=context,
        )

        output_key = f"{agent.agent_type.value}_output"
        return {
            "current_agent": agent.agent_type.value,
            output_key: result,
            "iteration": state.get("iteration", 0) + 1,
            "artifacts": state.get("artifacts", []) + agent.artifacts,
            "messages": state.get("messages", []) + [
                {"role": agent.agent_type.value, "content": result}
            ],
            "thinking_steps": state.get("thinking_steps", []) + agent.thinking_steps,
        }

    return node_fn
