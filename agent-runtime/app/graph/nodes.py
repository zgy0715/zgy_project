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


async def coder_node(state: WorkflowState) -> dict[str, Any]:
    """Execute the Coder agent node in the workflow.

    Args:
        state: Current workflow state.

    Returns:
        State updates from the coder agent execution.
    """
    logger.info("Executing Coder node for task: %s", state.get("task", ""))

    agent = CoderAgent(name="workflow-coder")
    result = await agent.run(
        task=state.get("task", ""),
        context=state.get("context", {}),
    )

    return {
        "current_agent": "coder",
        "code_output": result,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "coder", "content": result}
        ],
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
    agent = ReviewerAgent(name="workflow-reviewer")
    result = await agent.run(
        task=f"Review the following code:\n{code_output}",
        context=state.get("context", {}),
    )

    return {
        "current_agent": "reviewer",
        "review_output": result,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "reviewer", "content": result}
        ],
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
    agent = TesterAgent(name="workflow-tester")
    result = await agent.run(
        task=f"Generate tests for the following code:\n{code_output}",
        context=state.get("context", {}),
    )

    return {
        "current_agent": "tester",
        "test_output": result,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "tester", "content": result}
        ],
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
    agent = DeployerAgent(name="workflow-deployer")
    result = await agent.run(
        task=f"Generate deployment config for the following code:\n{code_output}",
        context=state.get("context", {}),
    )

    return {
        "current_agent": "deployer",
        "deploy_output": result,
        "artifacts": state.get("artifacts", []) + agent.artifacts,
        "messages": state.get("messages", []) + [
            {"role": "deployer", "content": result}
        ],
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

        result = await agent.run(
            task=state.get("task", ""),
            context=state.get("context", {}),
        )

        output_key = f"{agent.agent_type.value}_output"
        return {
            "current_agent": agent.agent_type.value,
            output_key: result,
            "artifacts": state.get("artifacts", []) + agent.artifacts,
            "messages": state.get("messages", []) + [
                {"role": agent.agent_type.value, "content": result}
            ],
        }

    return node_fn
