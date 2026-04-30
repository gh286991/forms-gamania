import React, { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

function getEditorMarkdown(editor: { storage: unknown }): string {
  return (editor.storage as { markdown?: { getMarkdown?: () => string } })
    .markdown?.getMarkdown?.() || "";
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "180px"
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  const suppressRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true
      })
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "rich-editor-content",
        "data-placeholder": placeholder || ""
      }
    },
    onUpdate: ({ editor: currentEditor }: { editor: any }) => {
      if (suppressRef.current) return;
      onChangeRef.current(getEditorMarkdown(currentEditor));
    }
  } as never);

  useEffect(() => {
    if (!editor) return;
    const current = getEditorMarkdown(editor);
    if (current === (value || "")) return;
    suppressRef.current = true;
    try {
      editor.commands.setContent(value || "");
    } finally {
      suppressRef.current = false;
    }
  }, [editor, value]);

  function run(command: (e: NonNullable<typeof editor>) => boolean) {
    if (!editor) return;
    command(editor);
  }

  function isActive(name: string, attrs?: Record<string, unknown>): string {
    return editor?.isActive(name, attrs) ? " active" : "";
  }

  return (
    <div className="rich-editor" style={{ "--rich-min-height": minHeight } as React.CSSProperties}>
      {editor && (
        <BubbleMenu editor={editor} className="bubble-menu">
          <button type="button" className={isActive("bold")} onClick={() => run((e) => e.chain().focus().toggleBold().run())}>B</button>
          <button type="button" className={isActive("italic")} onClick={() => run((e) => e.chain().focus().toggleItalic().run())}>I</button>
          <span className="bubble-sep" />
          <button type="button" className={isActive("heading", { level: 1 })} onClick={() => run((e) => e.chain().focus().toggleHeading({ level: 1 }).run())}>H1</button>
          <button type="button" className={isActive("heading", { level: 2 })} onClick={() => run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}>H2</button>
          <button type="button" className={isActive("heading", { level: 3 })} onClick={() => run((e) => e.chain().focus().toggleHeading({ level: 3 }).run())}>H3</button>
          <span className="bubble-sep" />
          <button type="button" className={isActive("bulletList")} onClick={() => run((e) => e.chain().focus().toggleBulletList().run())}>•</button>
          <button type="button" className={isActive("orderedList")} onClick={() => run((e) => e.chain().focus().toggleOrderedList().run())}>1.</button>
          <button type="button" className={isActive("codeBlock")} onClick={() => run((e) => e.chain().focus().toggleCodeBlock().run())}>&lt;/&gt;</button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
