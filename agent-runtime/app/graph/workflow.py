"""LangGraph workflow definition for agent DAG orchestration.

Supports both a default fixed graph and custom DAG definitions
provided through the API.
"""

import logging
from typing import Any

from langgraph.graph import END, StateGraph

from app.graph.edges import (
    route_after_coder,
    route_after_deployer,
    route_after_reviewer,
    route_after_tester,
)
from app.graph.nodes import coder_node, deployer_node, reviewer_node, tester_node
from app.graph.state import WorkflowState, create_initial_state

logger = logging.getLogger(__name__)

# Mapping from agent type strings to node functions
_AGENT_NODE_MAP: dict[str, Any] = {
    "coder": coder_node,
    "reviewer": reviewer_node,
    "tester": tester_node,
    "deployer": deployer_node,
}

# Mapping from edge source to conditional routing functions
_CONDITIONAL_ROUTE_MAP: dict[str, Any] = {
    "coder": route_after_coder,
    "reviewer": route_after_reviewer,
    "tester": route_after_tester,
    "deployer": route_after_deployer,
}


class WorkflowEngine:
    """Engine for building and executing LangGraph workflows.

    Creates a DAG of agent nodes with conditional edges
    that determine the flow based on each agent's output.

    Supports both the default fixed graph and custom DAG
    definitions from the API.

    Example:
        >>> engine = WorkflowEngine()
        >>> result = await engine.run("Implement a REST API endpoint")
    """

    def __init__(self) -> None:
        """Initialize the workflow engine and build the default graph."""
        self.graph = self._build_graph()
        self.compiled = self.graph.compile()

    def _build_graph(self) -> StateGraph:
        """Build the default LangGraph StateGraph with agent nodes and edges.

        Returns:
            A StateGraph ready for compilation.
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
        """Execute the default workflow for a given task.

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

    async def run_custom(
        self,
        workflow_def: dict[str, Any],
        task: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a custom workflow defined by API-provided nodes and edges.

        Builds a StateGraph from the workflow definition, compiles it,
        and runs it with the given task.

        Args:
            workflow_def: Dict with "nodes" and "edges" lists defining the DAG.
            task: The task description to execute.
            context: Optional additional context.

        Returns:
            The final workflow state after execution.
        """
        nodes = workflow_def.get("nodes", [])
        edges = workflow_def.get("edges", [])

        logger.info(
            "Starting custom workflow execution with %d nodes, %d edges",
            len(nodes),
            len(edges),
        )

        try:
            graph = self.build_graph_from_config(nodes, edges)
            compiled = graph.compile()
            initial_state = create_initial_state(task, context)

            result = await compiled.ainvoke(initial_state)
            logger.info("Custom workflow execution completed")
            return dict(result)
        except Exception as e:
            logger.error("Custom workflow execution failed: %s", str(e))
            initial_state = create_initial_state(task, context)
            return {
                **initial_state,
                "status": "failed",
                "errors": [str(e)],
            }

    @staticmethod
    def build_graph_from_config(
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
    ) -> StateGraph:
        """Build a StateGraph from API-provided node and edge configurations.

        Maps agent types to their node functions and sets up conditional
        or static edges based on the edge definitions.

        Args:
            nodes: List of node configs, each with "id", "agent_type", "name".
            edges: List of edge configs, each with "source", "target",
                   and optional "condition".

        Returns:
            A StateGraph ready for compilation.

        Raises:
            ValueError: If a node references an unknown agent type.
        """
        graph = StateGraph(WorkflowState)

        # Track node IDs for edge resolution
        node_ids: set[str] = set()
        entry_point: str | None = None

        # Add nodes
        for node_config in nodes:
            node_id = node_config["id"]
            agent_type = node_config["agent_type"]

            if agent_type not in _AGENT_NODE_MAP:
                raise ValueError(
                    f"Unknown agent type '{agent_type}' for node '{node_id}'. "
                    f"Available types: {list(_AGENT_NODE_MAP.keys())}"
                )

            node_fn = _AGENT_NODE_MAP[agent_type]
            graph.add_node(node_id, node_fn)
            node_ids.add(node_id)

            # First node is the entry point
            if entry_point is None:
                entry_point = node_id

        if entry_point is None:
            raise ValueError("Workflow must have at least one node")

        graph.set_entry_point(entry_point)

        # Group edges by source for conditional edge handling
        edges_by_source: dict[str, list[dict[str, Any]]] = {}
        for edge_config in edges:
            source = edge_config["source"]
            edges_by_source.setdefault(source, []).append(edge_config)

        # Add edges
        for source_id, source_edges in edges_by_source.items():
            if source_id not in node_ids:
                logger.warning("Edge source '%s' not found in nodes, skipping", source_id)
                continue

            # Check if any edge has a condition (conditional edges)
            conditional_edges = [e for e in source_edges if e.get("condition")]
            unconditional_edges = [e for e in source_edges if not e.get("condition")]

            if conditional_edges:
                # Build conditional edge mapping
                route_fn = _CONDITIONAL_ROUTE_MAP.get(source_id)
                if route_fn is not None:
                    # Use the built-in routing function for known agent types
                    response_map: dict[str, str] = {}

                    for edge in conditional_edges:
                        target = edge["target"]
                        condition = edge["condition"]
                        # Map condition keywords to target nodes
                        response_map[condition] = target

                    # Add END mapping if not present
                    if "end" not in response_map:
                        response_map["end"] = END

                    # Ensure all targets are valid node IDs or END
                    resolved_map: dict[str, str] = {}
                    for key, target in response_map.items():
                        if target == "end" or target == END:
                            resolved_map[key] = END
                        elif target in node_ids:
                            resolved_map[key] = target
                        else:
                            logger.warning(
                                "Conditional edge target '%s' not found, mapping to END",
                                target,
                            )
                            resolved_map[key] = END

                    graph.add_conditional_edges(source_id, route_fn, resolved_map)
                else:
                    # No built-in route function; add as static edges
                    for edge in conditional_edges:
                        target = edge["target"]
                        if target in node_ids:
                            graph.add_edge(source_id, target)
                        else:
                            logger.warning(
                                "Edge target '%s' not found, skipping edge from '%s'",
                                target,
                                source_id,
                            )

            # Add unconditional (static) edges
            for edge in unconditional_edges:
                target = edge["target"]
                if target == "end" or target == END:
                    graph.add_edge(source_id, END)
                elif target in node_ids:
                    graph.add_edge(source_id, target)
                else:
                    logger.warning(
                        "Edge target '%s' not found, skipping edge from '%s'",
                        target,
                        source_id,
                    )

        # Ensure nodes without outgoing edges connect to END
        nodes_with_outgoing: set[str] = set()
        for edge_config in edges:
            nodes_with_outgoing.add(edge_config["source"])

        for node_id in node_ids:
            if node_id not in nodes_with_outgoing:
                graph.add_edge(node_id, END)

        return graph


def build_custom_graph(
    nodes_config: list[dict[str, Any]],
    edges_config: list[dict[str, Any]],
) -> StateGraph:
    """Build a custom StateGraph from node and edge configurations.

    Convenience function that delegates to WorkflowEngine.build_graph_from_config.

    Args:
        nodes_config: List of node configurations.
        edges_config: List of edge configurations.

    Returns:
        A StateGraph ready for compilation.
    """
    return WorkflowEngine.build_graph_from_config(nodes_config, edges_config)
