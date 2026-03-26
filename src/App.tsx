import React, { useState, useRef, useEffect, Component } from "react";
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import mammoth from "mammoth";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Target, 
  Zap, 
  ShieldCheck,
  RefreshCw,
  FileUp,
  BrainCircuit,
  ChevronRight,
  Info,
  XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer
} from "recharts";
import { cn } from "./lib/utils";

// Set PDF.js worker using Vite-compatible URL resolution
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.js",
  import.meta.url
).href;
console.log("PDF Worker", pdfjsLib.GlobalWorkerOptions.workerSrc);

interface AnalysisResult {
  score: number;
  summary: string;
  categories: {
    skills: { score: number; confidence: string; reason: string };
    experience: { score: number; confidence: string; reason: string };
    education: { score: number; confidence: string; reason: string };
    culturalFit: { score: number; confidence: string; reason: string };
  };
  matchingDetails: {
    strengths: string[];
    weaknesses: string[];
  };
  optimizationSuggestions: {
    step: number;
    title: string;
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    example: string;
    reason: string;
  }[];
  missingKeywords: string[];
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component to catch and display errors gracefully.
 */
// @ts-ignore
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    // @ts-ignore
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div id="error-boundary-fallback" className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">应用运行出错</h2>
            <p className="text-slate-600 mb-6">很抱歉，程序在运行过程中遇到了意外错误。请尝试刷新页面。</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
            >
              刷新页面
            </button>
            {/* @ts-ignore */}
            {this.state.error && (
              <pre className="mt-6 p-4 bg-slate-900 text-slate-300 text-xs rounded-lg text-left overflow-auto max-h-40">
                {/* @ts-ignore */}
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

function AppContent() {
  const [resumeText, setResumeText] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [optimizedResume, setOptimizedResume] = useState<string>("");
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Test connection to Firestore if needed (as per guidelines, though not using Firestore here yet)
  useEffect(() => {
    console.log("SpeedyJob.ai Initialized");
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("Uploaded file:", file);

    // Increase limit to 100MB
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("文件太大。请上传小于 100MB 的文件。");
      return;
    }

    setFileName(file.name);
    setError(null);
    setIsParsing(true);
    
    try {
      if (file.name.endsWith(".pdf")) {
        const reader = new FileReader();

        reader.onload = async () => {
          try {
            if (!reader.result) {
              throw new Error("FileReader result is empty");
            }

            const typedArray = new Uint8Array(reader.result as ArrayBuffer);

            // @ts-ignore
            const loadingTask = pdfjsLib.getDocument(typedArray);
            
            loadingTask.promise
              .then(pdf => console.log("PDF loaded, pages:", pdf.numPages))
              .catch(err => console.error("PDF load error:", err));

            const pdf = await loadingTask.promise;

            console.log("PDF Loaded, pages:", pdf.numPages);
            
            // @ts-ignore
            const docId = pdf.fingerprint || (pdf.fingerprints && pdf.fingerprints[0]) || "unknown";
            console.log("Fingerprint (docId):", docId);

            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(" ");
              fullText += pageText + "\n";
            }
            setResumeText(fullText);
          } catch (err: any) {
            console.error("PDF parsing error:", err);
            setError(`PDF 解析失败: ${err.message || "文件可能已加密或损坏"}`);
          } finally {
            setIsParsing(false);
          }
        };

        reader.readAsArrayBuffer(file);
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const arrayBuffer = reader.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            setResumeText(result.value);
          } catch (err: any) {
            console.error("Docx parsing error:", err);
            setError(`DOCX 文件解析失败: ${err.message}`);
          } finally {
            setIsParsing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setError("不支持的文件格式。请上传 PDF 或 DOCX 文件。");
        setIsParsing(false);
      }
    } catch (err: any) {
      console.error("Error handling file upload:", err);
      setError(`文件上传过程中发生意外错误: ${err.message}`);
      setIsParsing(false);
    }
  };

  const analyzeMatch = async () => {
    if (!resumeText || !jdText) {
      setError("请同时提供简历和职位描述 (JD)。");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setOptimizedResume(""); // Reset previous optimized resume on new analysis

    abortControllerRef.current = new AbortController();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3.1-pro-preview";

      const safeResume = resumeText.slice(0, 3000);
      const safeJD = jdText.slice(0, 2000);

      const prompt = `
        作为资深 HR 和职业规划导师，请深度分析以下简历与职位描述 (JD) 的匹配度。
        
        简历内容: ${safeResume}
        职位描述: ${safeJD}
        
        请按照以下要求进行评分和建议：
        1. 评分维度：
           - skills (技能匹配): 核心技术栈与工具的重合度。
           - experience (经验匹配): 行业背景、项目深度与年限。
           - education (教育背景): 学历、专业与 JD 要求的对齐度。
           - culturalFit (文化契合): 价值观、软技能与团队氛围。
        
        2. 信息充分性判断：
           - 对每个维度，如果简历中信息不充分，请将 confidence 设为 'low'，score 设为 0-30。
           - 如果信息中等，confidence 为 'medium'。
           - 如果信息充分，confidence 为 'high'。
        
        3. 优化路线图 (optimizationSuggestions)：
           - 提供 3-5 个具体的、可执行的步骤。
           - 每个步骤包含 step (1, 2, 3...), title (模块名), priority (high/medium/low), suggestion (具体建议), example (优化后的示例), reason (优化理由)。
        
        请严格返回 JSON 格式。
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              categories: {
                type: Type.OBJECT,
                properties: {
                  skills: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.NUMBER },
                      confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
                      reason: { type: Type.STRING }
                    },
                    required: ["score", "confidence", "reason"]
                  },
                  experience: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.NUMBER },
                      confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
                      reason: { type: Type.STRING }
                    },
                    required: ["score", "confidence", "reason"]
                  },
                  education: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.NUMBER },
                      confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
                      reason: { type: Type.STRING }
                    },
                    required: ["score", "confidence", "reason"]
                  },
                  culturalFit: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.NUMBER },
                      confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
                      reason: { type: Type.STRING }
                    },
                    required: ["score", "confidence", "reason"]
                  }
                },
                required: ["skills", "experience", "education", "culturalFit"]
              },
              matchingDetails: {
                type: Type.OBJECT,
                properties: {
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["strengths", "weaknesses"]
              },
              optimizationSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                    suggestion: { type: Type.STRING },
                    example: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  },
                  required: ["step", "title", "priority", "suggestion", "example", "reason"]
                }
              },
              missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["score", "summary", "categories", "matchingDetails", "optimizationSuggestions", "missingKeywords"]
          },
          abortSignal: abortControllerRef.current?.signal,
        }
      });

      if (abortControllerRef.current?.signal.aborted) return;
      
      const parsedResult = JSON.parse(response.text);
      setResult(parsedResult);
    } catch (err: any) {
      if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) return;
      console.error("Analysis error:", err);
      setError("分析失败，请重试。");
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsAnalyzing(false);
        abortControllerRef.current = null;
      }
    }
  };

  const stopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsAnalyzing(false);
      setError("分析已停止。");
    }
  };

  const generateOptimizedResume = async () => {
    if (!result || !resumeText) return;
    
    setIsGeneratingResume(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3.1-pro-preview";

      const prompt = `
        你是一位专业的简历优化专家。请根据以下输入生成一份优化后的简历。

        ### 输入数据：
        1. **原始简历文本**: 
        ${resumeText.slice(0, 4000)}

        2. **AI 分析结果**:
        - 匹配得分: ${result.score}
        - 核心总结: ${result.summary}
        - 缺失关键词: ${result.missingKeywords.join(", ")}

        3. **修改建议**:
        ${result.optimizationSuggestions.map(opt => `- ${opt.title}: ${opt.suggestion}`).join("\n")}

        ### 要求：
        - 自动补充缺失的技能和关键词。
        - 保留原简历中已有的核心工作经历、项目经验、教育信息。
        - 精炼语言，条理清晰，使用 STAR 法则描述项目，适合 HR 快速阅读。
        - **重要**：请使用 **粗体** (Markdown 语法) 标记出新增或有重大修改的内容。
        - 输出格式：直接输出纯文本简历，不需要 JSON，不输出任何开场白或额外解释。
      `;

      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "你是一个只输出简历文本的机器人。不要说'好的'、'这是优化后的简历'等废话。直接从姓名或简历标题开始输出。",
        }
      });

      setOptimizedResume(response.text || "");
    } catch (err: any) {
      console.error("Resume generation error:", err);
      setError("生成优化简历失败，请重试。");
    } finally {
      setIsGeneratingResume(false);
    }
  };

  const radarData = result ? [
    { subject: '技能匹配', A: result.categories.skills.score, fullMark: 100 },
    { subject: '经验匹配', A: result.categories.experience.score, fullMark: 100 },
    { subject: '教育背景', A: result.categories.education.score, fullMark: 100 },
    { subject: '文化契合', A: result.categories.culturalFit.score, fullMark: 100 },
  ] : [];

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50 border-green-100';
      case 'medium': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'low': return 'text-slate-400 bg-slate-50 border-slate-100';
      default: return 'text-slate-400 bg-slate-50 border-slate-100';
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'high': return '高置信度';
      case 'medium': return '中置信度';
      case 'low': return '低置信度';
      default: return '未知';
    }
  };

  return (
    <div id="app-root" className="min-h-screen bg-[#050b1a] text-white font-sans selection:bg-blue-500/30 relative overflow-hidden">
      {/* Atmospheric Background Elements */}
      <div className="fixed inset-0 tech-grid pointer-events-none opacity-20" />
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header id="app-header" className="px-8 py-6 flex justify-between items-center max-w-7xl mx-auto relative z-10">
        <div id="header-logo" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-white">SpeedyJob<span className="text-blue-500">.ai</span></h1>
        </div>
        <nav id="header-nav" className="hidden md:flex items-center gap-10">
          <div className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">
            人才中心
          </div>
          <div className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">
            简历优化
          </div>
          <div className="flex items-center gap-1 cursor-pointer text-slate-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">
            CN
          </div>
          <button className="px-6 py-2 rounded-full border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-500/10 transition-all">
            登录
          </button>
        </nav>
      </header>

      <main id="main-content" className="max-w-5xl mx-auto px-6 py-20 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-20 space-y-6">
          <div className="inline-block px-4 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">
            AI-Powered Career Intelligence
          </div>
          <h2 className="text-7xl font-display font-bold tracking-tighter leading-none">
            简历<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">智能诊断</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto font-light">
            利用最先进的 Gemini 3.1 Pro 模型，为您的简历提供深度的行业级评估与优化建议。
          </p>
        </div>

        {/* Main Input Card */}
        <div className="glass-card rounded-[40px] p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">姓名 (Required)</label>
              <input 
                type="text" 
                placeholder="请输入您的姓名"
                className="w-full bg-[#0a1227]/50 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">目标岗位 (Required)</label>
              <input 
                type="text" 
                placeholder="例如：高级前端开发工程师"
                className="w-full bg-[#0a1227]/50 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all font-medium"
              />
            </div>
          </div>

          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">岗位描述 (Optional)</label>
              <span className="text-[10px] text-slate-600 font-mono">0 / 2000 CHARS</span>
            </div>
            <textarea 
              id="jd-textarea"
              value={jdText}
              onChange={(e) => {
                setJdText(e.target.value);
                setOptimizedResume("");
              }}
              placeholder="请粘贴您心仪职位的描述内容，AI 将根据 JD 进行精准匹配分析..."
              className="w-full h-48 bg-[#0a1227]/50 border border-slate-800 rounded-2xl px-6 py-5 text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all resize-none font-medium leading-relaxed"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                简历文件 (PDF/DOCX)
              </label>
              <div className="flex gap-4">
                <span className="text-[10px] text-slate-600 font-mono">MAX 100MB</span>
                <span className="text-[10px] text-slate-600 font-mono">ENCRYPTED</span>
              </div>
            </div>

            <div 
              id="upload-dropzone"
              onClick={() => !isParsing && fileInputRef.current?.click()}
              className={cn(
                "group relative border border-dashed border-slate-800 rounded-3xl p-16 text-center cursor-pointer transition-all hover:border-blue-500/50 hover:bg-blue-500/5",
                fileName && "border-blue-500 bg-blue-500/10",
                isParsing && "cursor-wait opacity-70"
              )}
            >
              <input 
                id="resume-file-input"
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".pdf,.docx" 
                className="hidden" 
              />
              
              {isParsing ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 border-2 border-blue-500/20 rounded-full" />
                    <div className="absolute inset-0 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
                  </div>
                  <p className="text-slate-400 text-sm font-mono tracking-widest uppercase">Parsing Document...</p>
                </div>
              ) : fileName ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10">
                    <FileText className="w-8 h-8 text-blue-400" />
                  </div>
                  <span className="text-xl font-display font-bold text-white">{fileName}</span>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setFileName(""); 
                      setResumeText(""); 
                      setOptimizedResume("");
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-slate-900/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-slate-800">
                    <FileUp className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-display font-bold text-white">点击或拖拽上传简历</p>
                    <p className="text-sm text-slate-500">支持 PDF, DOCX 格式</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button 
            id="analyze-button"
            onClick={analyzeMatch}
            disabled={isAnalyzing || !resumeText || !jdText}
            className={cn(
              "w-full mt-12 py-6 bg-blue-600 text-white rounded-2xl font-display font-bold text-xl shadow-[0_20px_40px_rgba(37,99,235,0.2)] flex items-center justify-center gap-3 transition-all hover:bg-blue-500 hover:translate-y-[-2px] active:translate-y-[0] active:scale-[0.99]",
              (isAnalyzing || !resumeText || !jdText) && "opacity-50 cursor-not-allowed grayscale translate-y-0 shadow-none"
            )}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="tracking-widest uppercase text-sm">Processing Intelligence...</span>
              </>
            ) : (
              <>
                <Zap className="w-6 h-6 fill-white" />
                开始简历诊断
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div id="result-section" className="mt-24">
          <AnimatePresence mode="wait">
            {isAnalyzing ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="glass-card rounded-[40px] p-24 text-center space-y-10 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                <div className="relative w-32 h-32 mx-auto">
                  <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full" />
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                  <BrainCircuit className="absolute inset-0 m-auto w-12 h-12 text-blue-500 animate-pulse" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-4xl font-display font-bold tracking-tight">正在深度解析</h3>
                  <p className="text-slate-400 text-lg font-light">AI 正在对比您的简历与岗位要求的核心匹配度...</p>
                </div>
                <div className="flex justify-center gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Skills</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Exp</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fit</span>
                  </div>
                </div>
                <button 
                  onClick={stopAnalysis}
                  className="text-[10px] font-black text-red-400/60 hover:text-red-400 uppercase tracking-widest transition-colors"
                >
                  Cancel Analysis
                </button>
              </motion.div>
            ) : result && (
              <motion.div 
                key="result"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-16"
              >
                {/* Score & Radar Card */}
                <div className="glass-card rounded-[40px] p-12 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-12 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                  
                  <div className="flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-800/50 pb-12 md:pb-0 md:pr-12">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-8">Overall Match Score</span>
                    <div className="flex items-baseline gap-2 relative">
                      <span className="text-[140px] font-display font-bold tracking-tighter leading-none glow-text">{result.score}</span>
                      <span className="text-4xl font-display font-bold text-slate-600">%</span>
                    </div>
                    <div className={cn(
                      "mt-10 px-10 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-lg",
                      result.score > 80 ? "bg-green-500/10 text-green-400 border-green-500/20 shadow-green-500/5" : 
                      result.score > 60 ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5" : "bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5"
                    )}>
                      {result.score > 80 ? "Excellent Match" : result.score > 60 ? "Good Match" : "Low Match"}
                    </div>
                  </div>
                  
                  <div className="h-[400px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' }} />
                        <Radar
                          name="匹配度"
                          dataKey="A"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          fill="#3b82f6"
                          fillOpacity={0.2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Summary & Roadmap */}
                <div className="glass-card rounded-[40px] p-12 shadow-2xl space-y-16 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                  
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="text-2xl font-display font-bold tracking-tight">AI 核心总结</h3>
                    </div>
                    <div className="bg-[#0a1227]/50 rounded-3xl p-8 border border-slate-800/50 relative">
                      <div className="absolute top-4 left-4 text-4xl text-blue-500/10 font-serif">"</div>
                      <p className="text-slate-300 leading-relaxed text-xl font-light italic relative z-10 pl-4">
                        {result.summary}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        </div>
                        <h3 className="text-2xl font-display font-bold tracking-tight">优化路线图</h3>
                      </div>
                      {!optimizedResume && !isGeneratingResume && (
                        <button 
                          onClick={generateOptimizedResume}
                          className="px-8 py-3 bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-blue-50 transition-all shadow-xl shadow-white/5 active:scale-95"
                        >
                          一键生成优化简历
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {result.optimizationSuggestions.map((suggestion, index) => (
                        <div key={index} className="bg-[#0a1227]/50 rounded-[32px] p-10 border border-slate-800/50 group hover:border-blue-500/30 transition-all relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20 group-hover:bg-blue-500 transition-all" />
                          <div className="flex items-start gap-8">
                            <div className="text-5xl font-display font-bold text-slate-800 group-hover:text-blue-500/20 transition-colors leading-none">
                              {suggestion.step < 10 ? `0${suggestion.step}` : suggestion.step}
                            </div>
                            <div className="space-y-6 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xl font-display font-bold">{suggestion.title}</h4>
                                <div className={cn(
                                  "text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] border",
                                  suggestion.priority === 'high' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                  suggestion.priority === 'medium' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                )}>
                                  {suggestion.priority === 'high' ? 'High Priority' : suggestion.priority === 'medium' ? 'Medium Priority' : 'Low Priority'}
                                </div>
                              </div>
                              <p className="text-slate-400 leading-relaxed">{suggestion.suggestion}</p>
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/50">
                                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-3">优化示例</span>
                                  <p className="text-sm text-slate-300 font-mono italic leading-relaxed">"{suggestion.example}"</p>
                                </div>
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/50">
                                  <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest block mb-3">优化理由</span>
                                  <p className="text-sm text-slate-400 leading-relaxed">{suggestion.reason}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Optimized Resume Preview */}
                <AnimatePresence>
                  {(isGeneratingResume || optimizedResume) && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-green-400" />
                          </div>
                          <h3 className="text-2xl font-display font-bold tracking-tight">重构简历预览</h3>
                        </div>
                        {optimizedResume && (
                          <div className="flex gap-6">
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(optimizedResume.replace(/\*\*/g, ''));
                                alert("已复制纯文本");
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              Copy Plain Text
                            </button>
                            <button 
                              className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                            >
                              Download PDF
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="glass-card rounded-[40px] border border-slate-800/50 overflow-hidden shadow-2xl relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                        
                        {isGeneratingResume ? (
                          <div className="p-40 text-center space-y-8">
                            <div className="relative w-16 h-16 mx-auto">
                              <div className="absolute inset-0 border-2 border-blue-500/10 rounded-full" />
                              <div className="absolute inset-0 border-2 border-blue-500 rounded-full border-t-transparent animate-spin" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xl font-display font-bold">正在为您重构简历</p>
                              <p className="text-slate-500 text-sm font-mono tracking-widest uppercase">Synthesizing optimized content...</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-12 md:p-20 bg-[#050b1a]/50">
                            <div className="bg-white text-slate-900 p-12 md:p-20 rounded-2xl shadow-2xl min-h-[1000px] whitespace-pre-wrap font-serif leading-relaxed text-sm selection:bg-blue-100">
                              {optimizedResume.split('\n').map((line, i) => {
                                const parts = line.split(/(\*\*.*?\*\*)/g);
                                return (
                                  <p key={i} className="mb-3">
                                    {parts.map((part, j) => {
                                      if (part.startsWith('**') && part.endsWith('**')) {
                                        return <strong key={j} className="text-blue-600 bg-blue-50 px-1 rounded">{part.slice(2, -2)}</strong>;
                                      }
                                      return part;
                                    })}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-40 py-20 border-t border-slate-800/50 text-center relative z-10">
        <p className="text-slate-500 text-[10px] font-black tracking-[0.4em] uppercase">© 2026 SpeedyJob Intelligence · 智能求职，高效拿 Offer</p>
      </footer>

      {/* Floating Support Button */}
      <div className="fixed bottom-8 right-8">
        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/20 cursor-pointer hover:bg-blue-500 transition-all">
          <Info className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
