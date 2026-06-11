"""LangGraph workflow definition for agent DAG orchestration."""

import logging
from typing import Any

from langgraph.graph import END, StateGraph

from app.graph.edges import route_after_coder, route_after_reviewer, route_after_tester
from app.graph.nodes import coder_node, deployer_node, reviewer_node, tester_node
from app.graph.state import WorkflowState, create_initial_state

logger = logging.getLogger(__name__)


class WorkflowEngine:
    """Engine for building and executing LangGraph workflows.

    Creates a DAG of agent nodes with conditional edges
    that determine the flow based on each agent's output.

    Example:
        >>> engine = WorkflowEngine()
        >>> result = await engine.run("Implement a REST API endpoint")
    """

    def __init__(self) -> None:
        """Initialize the workflow engine and build the graph."""
        self.graph = self._build_graph()
        self.compiled = self.graph.compile()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph StateGraph with agent nodes and edges.

        Returns:
            A compiled StateGraph ready for execution.
        """
        graph = StateGraph(WorkflowState)

        # Add agent nodes
        graph.add_node("coder", coder_node)
        graph.add_node("reviewer", reviewer_node)
        graph.add_node("tester", tester_node)
        graph.add_node("deployer", deployer_node)

        # Set entry point
        graph.set_entry_point("coder")

        # Add conditional edges
        graph.add_conditional_edges(
            "coder",
            route_after_coder,
            {
                "reviewer": "reviewer",
                "coder": "coder",
                "end": END,
            },
        )

        graph.add_conditional_edges(
            "reviewer",
            route_after_reviewer,
            {
                "coder": "coder",
                "tester": "tester",
            },
        )

        graph.add_conditional_edges(
            "tester",
            route_after_tester,
            {
                "coder": "coder",
                "deployer": "deployer",
                "end": END,
            },
        )

        # Deployer is always the final agent node
        graph.add_edge("deployer", END)

        return graph

    async def run(
        self,
        task: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute the workflow for a given task.

        Args:
            task: The task description to execute.
            context: Optional additional context.

        Returns:
            The final workflow state after execution.
        """
        initial_state = create_initial_state(task, context)

        logger.info("Starting workflow execution for task: %s", task)

        try:
            result = await self.compiled.ainvoke(initial_state)
            logger.info("Workflow execution completed")
            return dict(result)
        except Exception as e:
            logger.error("Workflow execution failed: %s", str(e))
            return {
                **initial_state,
                "status": "failed",
                "errors": [str(e)],
            }

    async def stream(
        self,
        task: str,
        context: dict[str, Any] | None = None,
    ) -> Any:
        """Stream workflow execution events.

        Yields intermediate state updates as each node completes,
        useful for real-time UI updates.

        Args:
            task: The task description to execute.
            context: Optional additional context.

        Returns:
            An async generator of state updates.
        """
        initial_state = create_initial_state(task, context)

        logger.info("Starting streaming workflow for task: %s", task)

        async for event in self.compiled.astream(initial_state):
            yield event
