import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { SUPPORTED_LANGUAGES } from "./CodeBlockNode";
import styles from "./CodeBlockNode.module.scss";

const lowlight = createLowlight(common);

const ReadOnlyCodeBlockComponent = (props: ReactNodeViewProps<HTMLElement>) => {
  const { node } = props;
  const lang = node.attrs.language;

  const label =
    SUPPORTED_LANGUAGES.find((l) => l.value === lang)?.label ?? lang;

  return (
    <NodeViewWrapper className={styles.codeBlockNode}>
      {label && <div className={styles.codeBlockLanguageLabel}>{label}</div>}
      <pre>
        <NodeViewContent as="div" />
      </pre>
    </NodeViewWrapper>
  );
};

const ReadOnlyCodeBlockNode = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ReadOnlyCodeBlockComponent);
  },
}).configure({ lowlight });

export default ReadOnlyCodeBlockNode;
