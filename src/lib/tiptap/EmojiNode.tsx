import Emoji from "@/app/(sidebar)/components/Emoji";
import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

const LARGE_EMOJI_MAX = 3;
const emojiPluginKey = new PluginKey("largeEmoji");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    emoji: {
      insertEmoji: (emoji: string) => ReturnType;
    };
  }
}

export const EmojiNode = Node.create({
  name: "emoji",

  group: "inline",
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      emoji: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-emoji"),
        renderHTML: (attributes) => ({
          "data-emoji": attributes.emoji,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="emoji"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "emoji" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmojiComponent);
  },

  addCommands() {
    return {
      insertEmoji:
        (emoji: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { emoji },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: emojiPluginKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;

            let totalEmojiCount = 0;
            let hasNonEmoji = false;

            doc.forEach((paragraph) => {
              if (paragraph.type.name !== "paragraph") {
                hasNonEmoji = true;
                return;
              }

              paragraph.forEach((child) => {
                if (child.type.name === "emoji") {
                  totalEmojiCount++;
                } else if (child.isText) {
                  if (child.text && child.text.trim() !== "") {
                    hasNonEmoji = true;
                  }
                } else {
                  hasNonEmoji = true;
                }
              });
            });

            const isLarge =
              !hasNonEmoji &&
              totalEmojiCount > 0 &&
              totalEmojiCount <= LARGE_EMOJI_MAX;

            if (isLarge) {
              doc.forEach((paragraph, pos) => {
                if (paragraph.type.name !== "paragraph") return;
                decorations.push(
                  Decoration.node(pos, pos + paragraph.nodeSize, {
                    class: "emoji-only-large",
                  }),
                );
              });
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

function EmojiComponent({ node }: any) {
  return (
    <NodeViewWrapper
      as="span"
      className="emoji-node-wrapper"
      style={{
        display: "inline-block",
        verticalAlign: "text-bottom",
        lineHeight: "1em",
      }}
    >
      <Emoji emoji={node.attrs.emoji} size={18} style="apple" />
    </NodeViewWrapper>
  );
}
