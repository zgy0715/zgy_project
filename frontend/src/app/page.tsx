'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Github, ArrowRight, Play, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/hooks/use-auth';
import { API_MODE } from '@/lib/constants';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

// Terminal animation lines
const terminalLines = [
  { agent: 'Coder', color: 'text-blue-400', text: 'Generating UserService.java...' },
  { agent: 'Coder', color: 'text-blue-400', text: '✓ Created 3 files, +247 lines' },
  { agent: 'Reviewer', color: 'text-green-400', text: 'Found 2 issues in UserService.java' },
  { agent: 'Reviewer', color: 'text-green-400', text: '  ⚠ Missing null check on line 42' },
  { agent: 'Reviewer', color: 'text-green-400', text: '  ⚠ Potential SQL injection on line 89' },
  { agent: 'Coder', color: 'text-blue-400', text: 'Fixing issues... ✓ +12 lines changed' },
  { agent: 'Tester', color: 'text-yellow-400', text: 'Running test suite...' },
  { agent: 'Tester', color: 'text-yellow-400', text: 'All 12 tests passed ✓' },
  { agent: 'Deployer', color: 'text-purple-400', text: 'Deploying to staging... ✓ Done' },
];

// Feature cards data
const features = [
  {
    icon: '🧠',
    title: '多Agent编排',
    description: '基于 LangGraph 的 Agent 推理、规划与协作，让多个 AI Agent 像真实团队一样协同工作',
  },
  {
    icon: '🎨',
    title: '可视化工作流',
    description: '拖拽式 DAG 编排，自定义 Agent 执行流程，所见即所得的工作流设计',
  },
  {
    icon: '👁️',
    title: '思考链透明',
    description: '实时查看每个 Agent 的推理过程，让 AI 的每一步决策都清晰可见',
  },
  {
    icon: '🔍',
    title: '语义代码搜索',
    description: '自研 C++ HNSW 向量引擎，毫秒级语义代码检索，精准定位代码上下文',
  },
  {
    icon: '🧪',
    title: '自动测试生成',
    description: 'Tester Agent 自动生成并执行测试，确保代码质量，覆盖边界场景',
  },
  {
    icon: '🔄',
    title: '代码审查闭环',
    description: 'Reviewer 检测 Bug、安全漏洞与代码风格问题，形成完整的质量闭环',
  },
];

// Architecture layers
const archLayers = [
  { name: '前端', tech: 'Next.js', color: 'bg-blue-500', textColor: 'text-blue-400', borderColor: 'border-blue-500/30' },
  { name: 'API 网关', tech: 'Java', color: 'bg-orange-500', textColor: 'text-orange-400', borderColor: 'border-orange-500/30' },
  { name: 'Agent 运行时', tech: 'Python', color: 'bg-green-500', textColor: 'text-green-400', borderColor: 'border-green-500/30' },
  { name: '向量引擎', tech: 'C++', color: 'bg-purple-500', textColor: 'text-purple-400', borderColor: 'border-purple-500/30' },
];

// Agent cards data
const agents = [
  {
    name: 'Coder',
    emoji: '💻',
    description: '根据需求生成高质量代码，支持多种编程语言和框架',
    tags: ['代码生成', 'Bug修复', '重构'],
    color: 'blue',
    gradient: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/30',
    tagBg: 'bg-blue-500/10 text-blue-400',
  },
  {
    name: 'Reviewer',
    emoji: '🔍',
    description: '深度审查代码质量，检测安全漏洞与风格问题',
    tags: ['代码审查', '安全检测', '风格检查'],
    color: 'green',
    gradient: 'from-green-500/20 to-green-600/5',
    border: 'border-green-500/30',
    tagBg: 'bg-green-500/10 text-green-400',
  },
  {
    name: 'Tester',
    emoji: '🧪',
    description: '自动生成单元测试与集成测试，确保代码可靠性',
    tags: ['测试生成', '覆盖率', '回归测试'],
    color: 'yellow',
    gradient: 'from-yellow-500/20 to-yellow-600/5',
    border: 'border-yellow-500/30',
    tagBg: 'bg-yellow-500/10 text-yellow-400',
  },
  {
    name: 'Deployer',
    emoji: '🚀',
    description: '自动化部署流程，管理环境配置与发布策略',
    tags: ['CI/CD', '容器化', '环境管理'],
    color: 'purple',
    gradient: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/30',
    tagBg: 'bg-purple-500/10 text-purple-400',
  },
];

export default function HomePage() {
  const { login } = useAuth();
  const router = useRouter();
  const isMock = API_MODE === 'mock';

  const handleDemoClick = async () => {
    if (isMock) {
      await login({ username: 'demo', password: 'demo' });
    } else {
      router.push('/dashboard');
    }
  };

  // Terminal animation state
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (visibleLines >= terminalLines.length) {
      // Reset after all lines shown
      const timer = setTimeout(() => {
        setVisibleLines(0);
        setCurrentText('');
      }, 3000);
      return () => clearTimeout(timer);
    }

    const line = terminalLines[visibleLines];
    let charIndex = 0;
    setIsTyping(true);
    setCurrentText('');

    const typeInterval = setInterval(() => {
      if (charIndex < line.text.length) {
        setCurrentText(line.text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        // Move to next line after a pause
        setTimeout(() => {
          setVisibleLines((prev) => prev + 1);
          setCurrentText('');
        }, 800);
      }
    }, 30);

    return () => clearInterval(typeInterval);
  }, [visibleLines]);

  return (
    <div className="min-h-screen bg-surface-0 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-surface-3 bg-surface-0/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <span className="text-white font-bold text-sm">DA</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">DeepAgent</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/deepagent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <Link
              href="/auth/register"
              className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-brand-500/25"
            >
              开始体验
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 pt-12">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl text-center space-y-8 relative z-10"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="flex justify-center">
            <div className="inline-flex items-center gap-2 bg-surface-1/80 backdrop-blur border border-surface-3 rounded-full px-4 py-1.5 text-sm text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Multi-Agent AI Platform
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            <span className="text-white">用 AI Agent 团队</span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-violet-400 to-purple-400">
              重构开发流程
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            DeepAgent 编排多个 AI Agent 协同规划、编码、审查、测试与部署，
            以智能协作重新定义软件开发
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="group bg-brand-500 hover:bg-brand-600 text-white px-8 py-3.5 rounded-lg text-lg font-medium transition-all hover:shadow-xl hover:shadow-brand-500/25 flex items-center gap-2"
            >
              开始体验
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <button
              onClick={handleDemoClick}
              className="border border-surface-3 hover:border-brand-500/50 text-zinc-300 hover:text-white px-8 py-3.5 rounded-lg text-lg font-medium transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              查看演示
            </button>
          </motion.div>

          {/* Terminal Window */}
          <motion.div variants={itemVariants} className="mt-8 max-w-2xl mx-auto">
            <div className="bg-surface-1/80 backdrop-blur border border-surface-3 rounded-xl overflow-hidden shadow-2xl shadow-black/40">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-3 bg-surface-1">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-zinc-500 ml-2 font-mono">agent-collaboration</span>
              </div>
              {/* Terminal body */}
              <div className="p-4 font-mono text-sm space-y-1.5 min-h-[200px]">
                {terminalLines.slice(0, visibleLines).map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-zinc-600 select-none shrink-0">&gt;</span>
                    <span className={line.color}>{line.agent}:</span>
                    <span className="text-zinc-300">{line.text}</span>
                  </div>
                ))}
                {/* Currently typing line */}
                {visibleLines < terminalLines.length && (
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-600 select-none shrink-0">&gt;</span>
                    <span className={terminalLines[visibleLines].color}>
                      {terminalLines[visibleLines].agent}:
                    </span>
                    <span className="text-zinc-300">
                      {currentText}
                      {isTyping && (
                        <span className="inline-block w-2 h-4 bg-brand-400 ml-0.5 animate-pulse" />
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <ChevronDown className="w-6 h-6 text-zinc-500 animate-bounce" />
        </motion.div>
      </section>

      {/* Core Features Section */}
      <section className="py-24 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-white">核心</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-violet-400">
                特性
              </span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              六大核心能力，覆盖软件开发生命周期的每一个环节
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="group bg-surface-1/80 backdrop-blur border border-surface-3 rounded-xl p-6 transition-all duration-300 hover:border-brand-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-24 px-6 relative">
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-white">技术</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-violet-400">
                架构
              </span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              四层架构设计，每层使用最适合的技术栈
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="space-y-0"
          >
            {archLayers.map((layer, index) => (
              <div key={layer.name}>
                {/* Layer card */}
                <div
                  className={`group relative bg-surface-1/80 backdrop-blur border ${layer.borderColor} rounded-xl p-6 transition-all duration-300 hover:border-opacity-100 hover:shadow-lg`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${layer.color} shadow-lg`} />
                      <div>
                        <h3 className="text-lg font-semibold text-white">{layer.name}</h3>
                        <p className={`text-sm ${layer.textColor}`}>{layer.tech}</p>
                      </div>
                    </div>
                    <div className={`text-xs ${layer.textColor} bg-surface-2 px-3 py-1 rounded-full border ${layer.borderColor}`}>
                      Layer {index + 1}
                    </div>
                  </div>
                </div>
                {/* Connector arrow */}
                {index < archLayers.length - 1 && (
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-surface-3" />
                      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-surface-3" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Agent Introduction Section */}
      <section className="py-24 px-6 relative">
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-white">Agent</span>{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-violet-400">
                团队
              </span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              四个专业 Agent 各司其职，协同完成从编码到部署的全流程
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {agents.map((agent) => (
              <motion.div
                key={agent.name}
                variants={itemVariants}
                className={`group bg-gradient-to-b ${agent.gradient} backdrop-blur border ${agent.border} rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="text-3xl mb-3">{agent.emoji}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{agent.name}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">{agent.description}</p>
                <div className="flex flex-wrap gap-2">
                  {agent.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-xs px-2.5 py-1 rounded-full ${agent.tagBg} border border-transparent`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-3 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} DeepAgent. Built with ❤️
        </div>
      </footer>
    </div>
  );
}
