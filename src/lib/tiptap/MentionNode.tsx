import type { Editor } from "@tiptap/core";
import { mergeAttributes } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import "./MentionNode.module.scss";

export type MentionSuggestionUser = {
  id: string;
  label: string;
  image?: string | null;
};

type MentionNodeOptions = {
  className?: string;
  suggestion?: ReturnType<typeof createMentionSuggestion>;
};

const ESCAPE_HTML_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPE_HTML_MAP[ch] ?? ch);
}

export function createMentionNode(options?: MentionNodeOptions) {
  const className = options?.className ?? "mentionNode";

  return Mention.configure({
    HTMLAttributes: {
      class: className,
    },
    renderText({ options: mentionOptions, node }) {
      const label = node.attrs.label ?? node.attrs.id;
      const mentionChar = mentionOptions.suggestion?.char ?? "@";
      return `${mentionChar}${label}`;
    },
    renderHTML({ options: mentionOptions, node }) {
      const label = node.attrs.label ?? node.attrs.id;
      const mentionChar = mentionOptions.suggestion?.char ?? "@";
      return [
        "span",
        mergeAttributes(mentionOptions.HTMLAttributes, {
          "data-type": "mention",
          "data-id": node.attrs.id,
          "data-label": label,
        }),
        `${mentionChar}${label}`,
      ];
    },
    ...(options?.suggestion ? { suggestion: options.suggestion } : {}),
  });
}

export function createMentionSuggestion(
  getItemsSource: () => MentionSuggestionUser[],
  isEnabled: () => boolean,
) {
  return {
    char: "@",
    allowSpaces: true,
    startOfLine: false,
    shouldShow: () => isEnabled(),
    items: ({ query }: { query: string }) => {
      const itemsSource = getItemsSource();
      const normalizedQuery = query.trim().toLowerCase();
      const filtered =
        normalizedQuery.length === 0
          ? itemsSource
          : itemsSource.filter((item) =>
              item.label.toLowerCase().includes(normalizedQuery),
            );

      return filtered.slice(0, 8);
    },
    command: ({
      editor,
      range,
      props,
    }: {
      editor: Editor;
      range: { from: number; to: number };
      props: { id: string | null; label?: string | null };
    }) => {
      if (!props.id) return;

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "mention",
            attrs: {
              id: props.id,
              label: props.label ?? props.id,
            },
          },
          { type: "text", text: " " },
        ])
        .run();
    },
    render: () => {
      let popupEl: HTMLDivElement | null = null;
      let selectedIndex = 0;
      let currentClientRect: (() => DOMRect | null) | null = null;
      let latestItems: MentionSuggestionUser[] = [];
      let latestCommand: ((item: MentionSuggestionUser) => void) | null = null;

      const updatePosition = () => {
        if (!popupEl || !currentClientRect) return;

        const rect = currentClientRect();
        if (!rect) return;

        const viewportPadding = 8;
        const offset = 8;
        const popupRect = popupEl.getBoundingClientRect();

        const maxLeft = window.innerWidth - popupRect.width - viewportPadding;
        const minLeft = viewportPadding;
        const left = Math.min(maxLeft, Math.max(minLeft, rect.left));

        const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
        const spaceAbove = rect.top - viewportPadding;
        const shouldPlaceAbove =
          spaceBelow < popupRect.height + offset && spaceAbove > spaceBelow;

        const top = shouldPlaceAbove
          ? Math.max(viewportPadding, rect.top - popupRect.height - offset)
          : Math.min(
              window.innerHeight - popupRect.height - viewportPadding,
              rect.bottom + offset,
            );

        popupEl.style.left = `${left}px`;
        popupEl.style.top = `${top}px`;
      };

      const onWindowUpdate = () => {
        updatePosition();
      };

      const bindWindowListeners = () => {
        window.addEventListener("resize", onWindowUpdate);
        window.addEventListener("scroll", onWindowUpdate, true);
      };

      const unbindWindowListeners = () => {
        window.removeEventListener("resize", onWindowUpdate);
        window.removeEventListener("scroll", onWindowUpdate, true);
      };

      const destroyPopup = () => {
        unbindWindowListeners();
        currentClientRect = null;
        if (popupEl?.parentElement) {
          popupEl.parentElement.removeChild(popupEl);
        }
        popupEl = null;
      };

      const selectItem = (
        props: {
          items: MentionSuggestionUser[];
          command: (item: MentionSuggestionUser) => void;
        },
        index: number,
      ) => {
        const item = props.items[index];
        if (item) props.command(item);
      };

      const renderList = (props: {
        items: MentionSuggestionUser[];
        command: (item: MentionSuggestionUser) => void;
      }) => {
        if (!popupEl) return;

        if (!props.items.length) {
          popupEl.innerHTML =
            '<div class="mentionEmpty">候補がありません</div>';
          return;
        }

        popupEl.innerHTML = props.items
          .map((item, index) => {
            const activeClass = index === selectedIndex ? " isActive" : "";
            const avatarHtml = item.image
              ? `<img class="mentionAvatarImg" src="${escapeHtml(item.image)}" alt="" />`
              : '<img class="mentionAvatarImg" src="/images/user-icon-default.png" alt="" />';

            return `
              <button type="button" class="mentionItem${activeClass}" data-index="${index}">
                <span class="mentionAvatar">${avatarHtml}</span>
                <span class="mentionLabel">${escapeHtml(item.label)}</span>
              </button>
            `;
          })
          .join("");

        const buttons = Array.from(
          popupEl.querySelectorAll<HTMLButtonElement>(".mentionItem"),
        );

        for (const button of buttons) {
          button.onmousedown = (event) => {
            event.preventDefault();
            const index = Number(button.dataset.index);
            selectItem(props, index);
          };
        }
      };

      return {
        onStart: (props: {
          items: MentionSuggestionUser[];
          command: (item: MentionSuggestionUser) => void;
          clientRect?: (() => DOMRect | null) | null;
        }) => {
          selectedIndex = 0;
          latestItems = props.items;
          latestCommand = props.command;
          popupEl = document.createElement("div");
          popupEl.className = "mentionSuggestion";
          popupEl.style.position = "fixed";
          document.body.appendChild(popupEl);

          renderList(props);
          currentClientRect = props.clientRect ?? null;
          bindWindowListeners();
          updatePosition();
        },
        onUpdate: (props: {
          items: MentionSuggestionUser[];
          command: (item: MentionSuggestionUser) => void;
          clientRect?: (() => DOMRect | null) | null;
        }) => {
          selectedIndex = 0;
          latestItems = props.items;
          latestCommand = props.command;
          renderList(props);
          currentClientRect = props.clientRect ?? null;
          updatePosition();
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          const event = props.event;
          const items =
            "items" in props && Array.isArray(props.items)
              ? (props.items as MentionSuggestionUser[])
              : latestItems;
          const command =
            "command" in props && typeof props.command === "function"
              ? (props.command as (item: MentionSuggestionUser) => void)
              : latestCommand;

          if (!items.length) {
            if (event.key === "Escape") {
              destroyPopup();
              return true;
            }
            return false;
          }

          if (event.key === "ArrowUp") {
            selectedIndex = (selectedIndex + items.length - 1) % items.length;
            if (command) {
              renderList({ items, command });
            }
            return true;
          }

          if (event.key === "ArrowDown") {
            selectedIndex = (selectedIndex + 1) % items.length;
            if (command) {
              renderList({ items, command });
            }
            return true;
          }

          if (event.key === "Enter" || event.key === "Tab") {
            if (!command) return false;
            event.preventDefault();
            selectItem({ items, command }, selectedIndex);
            return true;
          }

          if (event.key === "Escape") {
            destroyPopup();
            return true;
          }

          return false;
        },
        onExit: () => {
          destroyPopup();
          latestItems = [];
          latestCommand = null;
        },
      };
    },
  };
}
