"use client";

import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import styles from "./CodeBlockNode.module.scss";
import CodeLanguagePicker from "./CodeLangPicker";

const lowlight = createLowlight(common);

export const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "sql", label: "SQL" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "bash", label: "Bash" },
  { value: "yaml", label: "YAML" },
];

const CodeBlockComponent = (props: ReactNodeViewProps<HTMLElement>) => {
  const { node, updateAttributes } = props;
  const lang = node.attrs.language ?? "null";

  return (
    <NodeViewWrapper className={styles.codeBlockNode}>
      <div className={styles.codeBlockHeader}>
        <CodeLanguagePicker
          value={lang === "null" ? null : lang}
          languages={SUPPORTED_LANGUAGES}
          onSelect={(v: string | null) => updateAttributes({ language: v })}
        />
      </div>
      <pre>
        <NodeViewContent as="div" />
      </pre>
    </NodeViewWrapper>
  );
};

const CustomCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
}).configure({ lowlight });

export default CustomCodeBlock;
