package com.deepagent.scheduler.service;

import com.deepagent.common.exception.BusinessException;
import com.deepagent.scheduler.entity.Task;
import com.deepagent.scheduler.repository.TaskRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * DAG parser and validator for task dependency graphs.
 *
 * <p>Validates that a set of tasks with dependencies forms a valid
 * Directed Acyclic Graph (DAG). A valid DAG has no cycles, meaning
 * there is no circular dependency chain among tasks.</p>
 *
 * <p>Validation algorithm: Kahn's algorithm for topological sorting.
 * If the topological sort includes all nodes, the graph is a valid DAG.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DagParser {

    private final TaskRepository taskRepository;
    private final ObjectMapper objectMapper;

    /**
     * Validates that the tasks in a project form a valid DAG.
     *
     * @param projectId the project ID whose tasks to validate
     * @throws BusinessException if the task graph contains a cycle
     */
    public void validateDag(Long projectId) {
        var tasks = taskRepository.findByProjectId(projectId);
        if (tasks.isEmpty()) {
            return;
        }

        var adjacencyList = buildAdjacencyList(tasks);
        var inDegree = computeInDegrees(tasks, adjacencyList);

        // Kahn's algorithm: start with nodes that have no incoming edges
        var queue = new ArrayList<Long>();
        for (var entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        var sortedCount = 0;
        while (!queue.isEmpty()) {
            var current = queue.removeFirst();
            sortedCount++;

            var neighbors = adjacencyList.getOrDefault(current, List.of());
            for (var neighbor : neighbors) {
                inDegree.merge(neighbor, -1, Integer::sum);
                if (inDegree.get(neighbor) == 0) {
                    queue.add(neighbor);
                }
            }
        }

        if (sortedCount != tasks.size()) {
            throw new BusinessException(
                    "Invalid DAG: cycle detected in task dependencies for project " + projectId);
        }

        log.debug("DAG validation passed for project: {}", projectId);
    }

    /**
     * Performs topological sort on the task graph and returns the execution order.
     *
     * @param projectId the project ID
     * @return list of task IDs in topological order
     * @throws BusinessException if the graph contains a cycle
     */
    public List<Long> topologicalSort(Long projectId) {
        var tasks = taskRepository.findByProjectId(projectId);
        if (tasks.isEmpty()) {
            return List.of();
        }

        var adjacencyList = buildAdjacencyList(tasks);
        var inDegree = computeInDegrees(tasks, adjacencyList);

        var queue = new ArrayList<Long>();
        for (var entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        var result = new ArrayList<Long>();
        while (!queue.isEmpty()) {
            var current = queue.removeFirst();
            result.add(current);

            var neighbors = adjacencyList.getOrDefault(current, List.of());
            for (var neighbor : neighbors) {
                inDegree.merge(neighbor, -1, Integer::sum);
                if (inDegree.get(neighbor) == 0) {
                    queue.add(neighbor);
                }
            }
        }

        if (result.size() != tasks.size()) {
            throw new BusinessException(
                    "Invalid DAG: cycle detected in task dependencies for project " + projectId);
        }

        return result;
    }

    /**
     * Groups tasks into execution levels for parallel execution.
     *
     * <p>Tasks at the same level have no dependencies on each other
     * and can be executed concurrently.</p>
     *
     * @param projectId the project ID
     * @return list of execution levels, each containing task IDs that can run in parallel
     * @throws BusinessException if the graph contains a cycle
     */
    public List<List<Long>> getExecutionLevels(Long projectId) {
        var tasks = taskRepository.findByProjectId(projectId);
        if (tasks.isEmpty()) {
            return List.of();
        }

        var adjacencyList = buildAdjacencyList(tasks);
        var inDegree = computeInDegrees(tasks, adjacencyList);

        var levels = new ArrayList<List<Long>>();
        var currentLevel = new ArrayList<Long>();

        for (var entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                currentLevel.add(entry.getKey());
            }
        }

        while (!currentLevel.isEmpty()) {
            levels.add(new ArrayList<>(currentLevel));
            var nextLevel = new ArrayList<Long>();

            for (var taskId : currentLevel) {
                var neighbors = adjacencyList.getOrDefault(taskId, List.of());
                for (var neighbor : neighbors) {
                    inDegree.merge(neighbor, -1, Integer::sum);
                    if (inDegree.get(neighbor) == 0) {
                        nextLevel.add(neighbor);
                    }
                }
            }

            currentLevel = nextLevel;
        }

        var totalTasks = levels.stream().mapToInt(List::size).sum();
        if (totalTasks != tasks.size()) {
            throw new BusinessException(
                    "Invalid DAG: cycle detected in task dependencies for project " + projectId);
        }

        return levels;
    }

    /**
     * Builds an adjacency list from the task dependency relationships.
     *
     * <p>Edge direction: if task B depends on task A, then A -> B
     * (A must complete before B can start).</p>
     *
     * @param tasks the list of tasks
     * @return adjacency list mapping task IDs to their dependent task IDs
     */
    private Map<Long, List<Long>> buildAdjacencyList(List<Task> tasks) {
        var adjacencyList = new HashMap<Long, List<Long>>();
        var taskMap = new HashMap<Long, Task>();

        for (var task : tasks) {
            taskMap.put(task.getId(), task);
            adjacencyList.putIfAbsent(task.getId(), new ArrayList<>());
        }

        for (var task : tasks) {
            var deps = deserializeDependencies(task.getDependencies());
            for (var depId : deps) {
                if (!taskMap.containsKey(depId)) {
                    throw new BusinessException(
                            "Task " + task.getId() + " depends on non-existent task " + depId);
                }
                adjacencyList.computeIfAbsent(depId, k -> new ArrayList<>()).add(task.getId());
            }
        }

        return adjacencyList;
    }

    /**
     * Computes the in-degree (number of incoming edges) for each task node.
     *
     * @param tasks          the list of tasks
     * @param adjacencyList  the adjacency list
     * @return map of task IDs to their in-degree counts
     */
    private Map<Long, Integer> computeInDegrees(List<Task> tasks, Map<Long, List<Long>> adjacencyList) {
        var inDegree = new HashMap<Long, Integer>();
        for (var task : tasks) {
            inDegree.put(task.getId(), 0);
        }

        for (var entry : adjacencyList.entrySet()) {
            for (var dependent : entry.getValue()) {
                inDegree.merge(dependent, 1, Integer::sum);
            }
        }

        return inDegree;
    }

    /**
     * Deserializes a JSON string of dependency IDs.
     *
     * @param json the JSON string
     * @return the list of dependency IDs
     */
    private List<Long> deserializeDependencies(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to deserialize dependencies: {}", e.getMessage());
            return List.of();
        }
    }
}
