package com.deepagent.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ configuration for asynchronous event-driven messaging.
 *
 * <p>Defines exchanges, queues, and bindings for the following event flows:</p>
 * <ul>
 *   <li><b>Agent Task Events</b>: Task submission, completion, and failure notifications</li>
 *   <li><b>DAG Execution Events</b>: DAG start, node completion, and DAG completion</li>
 *   <li><b>Agent Output Events</b>: Real-time agent output for WebSocket broadcasting</li>
 * </ul>
 *
 * <p>Uses JSON message conversion for interoperability with Python services.</p>
 */
@Configuration
public class RabbitMQConfig {

    // Exchange names
    public static final String AGENT_EXCHANGE = "deepagent.agent.exchange";
    public static final String DAG_EXCHANGE = "deepagent.dag.exchange";
    public static final String AGENT_OUTPUT_EXCHANGE = "deepagent.agent.output.exchange";

    // Queue names
    public static final String AGENT_TASK_QUEUE = "deepagent.agent.task.queue";
    public static final String AGENT_RESULT_QUEUE = "deepagent.agent.result.queue";
    public static final String DAG_TASK_QUEUE = "deepagent.dag.task.queue";
    public static final String DAG_RESULT_QUEUE = "deepagent.dag.result.queue";
    public static final String AGENT_OUTPUT_QUEUE = "deepagent.agent.output.queue";

    // Routing keys
    public static final String AGENT_TASK_ROUTING_KEY = "agent.task.submit";
    public static final String AGENT_RESULT_ROUTING_KEY = "agent.task.result";
    public static final String DAG_TASK_ROUTING_KEY = "dag.task.execute";
    public static final String DAG_RESULT_ROUTING_KEY = "dag.task.result";
    public static final String AGENT_OUTPUT_ROUTING_KEY = "agent.output.stream";

    // --- Exchanges ---

    /**
     * Topic exchange for agent task events.
     *
     * @return the agent topic exchange
     */
    @Bean
    public TopicExchange agentExchange() {
        return new TopicExchange(AGENT_EXCHANGE, true, false);
    }

    /**
     * Topic exchange for DAG execution events.
     *
     * @return the DAG topic exchange
     */
    @Bean
    public TopicExchange dagExchange() {
        return new TopicExchange(DAG_EXCHANGE, true, false);
    }

    /**
     * Direct exchange for agent output streaming.
     *
     * @return the agent output direct exchange
     */
    @Bean
    public DirectExchange agentOutputExchange() {
        return new DirectExchange(AGENT_OUTPUT_EXCHANGE, true, false);
    }

    // --- Queues ---

    @Bean
    public Queue agentTaskQueue() {
        return new Queue(AGENT_TASK_QUEUE, true, false, false);
    }

    @Bean
    public Queue agentResultQueue() {
        return new Queue(AGENT_RESULT_QUEUE, true, false, false);
    }

    @Bean
    public Queue dagTaskQueue() {
        return new Queue(DAG_TASK_QUEUE, true, false, false);
    }

    @Bean
    public Queue dagResultQueue() {
        return new Queue(DAG_RESULT_QUEUE, true, false, false);
    }

    @Bean
    public Queue agentOutputQueue() {
        return new Queue(AGENT_OUTPUT_QUEUE, true, false, false);
    }

    // --- Bindings ---

    @Bean
    public Binding agentTaskBinding() {
        return BindingBuilder.bind(agentTaskQueue())
                .to(agentExchange())
                .with(AGENT_TASK_ROUTING_KEY);
    }

    @Bean
    public Binding agentResultBinding() {
        return BindingBuilder.bind(agentResultQueue())
                .to(agentExchange())
                .with(AGENT_RESULT_ROUTING_KEY);
    }

    @Bean
    public Binding dagTaskBinding() {
        return BindingBuilder.bind(dagTaskQueue())
                .to(dagExchange())
                .with(DAG_TASK_ROUTING_KEY);
    }

    @Bean
    public Binding dagResultBinding() {
        return BindingBuilder.bind(dagResultQueue())
                .to(dagExchange())
                .with(DAG_RESULT_ROUTING_KEY);
    }

    @Bean
    public Binding agentOutputBinding() {
        return BindingBuilder.bind(agentOutputQueue())
                .to(agentOutputExchange())
                .with(AGENT_OUTPUT_ROUTING_KEY);
    }

    // --- Message Converter ---

    /**
     * JSON message converter for RabbitMQ messages.
     *
     * @return the Jackson2JsonMessageConverter instance
     */
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * Configures RabbitTemplate with JSON message conversion.
     *
     * @param connectionFactory the RabbitMQ connection factory
     * @return the configured RabbitTemplate
     */
    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        var template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    /**
     * Configures the RabbitMQ listener container factory with JSON conversion
     * and virtual thread support.
     *
     * @param connectionFactory the RabbitMQ connection factory
     * @return the configured container factory
     */
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        var factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        factory.setConcurrentConsumers(2);
        factory.setMaxConcurrentConsumers(10);
        factory.setPrefetchCount(10);
        return factory;
    }
}
