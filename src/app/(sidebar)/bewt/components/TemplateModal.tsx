import { useState } from "react";
import styles from "./TemplateModal.module.scss";
import type { AppTemplate } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/Modal";

interface TemplateModalProps {
  open: boolean;
  templates: AppTemplate[];
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function TemplateModal({
  open,
  templates,
  onSelect,
  onClose,
}: TemplateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<AppTemplate | null>(
    null,
  );

  const handleInsert = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate.body);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="テンプレートを選択"
      description="挿入するテンプレートを選択してください"
      maxWidth="lg"
      footer={
        <>
          <button
            className={styles.templateCancelBtn}
            onClick={onClose}
            type="button"
          >
            キャンセル
          </button>
          <button
            className={styles.templateInsertBtn}
            onClick={handleInsert}
            disabled={!selectedTemplate}
            type="button"
          >
            挿入
          </button>
        </>
      }
    >
      <div className={styles.templateList}>
        {templates.map((template) => (
          <button
            type="button"
            key={template.id}
            className={cn(styles.templateItem, {
              [styles.selected]: selectedTemplate?.id === template.id,
            })}
            onClick={() => setSelectedTemplate(template)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setSelectedTemplate(template);
              }
            }}
          >
            <h4>{template.name}</h4>
            <div className={styles.templatePreview}>
              {template.body.substring(0, 100)}...
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
