import React from "react";
import Markdown from "react-native-markdown-display";
import { Colors } from "@/lib/constants";

const markdownStyles = {
  body: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 28,
  },
  heading1: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.primaryDark,
    marginTop: 16,
    marginBottom: 6,
  },
  heading2: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.primary,
    marginTop: 12,
    marginBottom: 4,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  heading3: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: 8,
    textAlign: "justify" as const,
  },
  strong: {
    fontWeight: "700" as const,
    color: Colors.text,
  },
  em: {
    fontStyle: "italic" as const,
    color: Colors.textSecondary,
  },
  blockquote: {
    backgroundColor: Colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  code_inline: {
    backgroundColor: "#F0F0F0",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: "monospace",
    fontSize: 14,
    color: Colors.primaryDark,
  },
  fence: {
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 8,
    fontFamily: "monospace",
    fontSize: 13,
  },
  list_item: {
    flexDirection: "row" as const,
    marginBottom: 4,
  },
  bullet_list: {
    marginVertical: 4,
    paddingLeft: 8,
  },
  ordered_list: {
    marginVertical: 4,
    paddingLeft: 8,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginVertical: 16,
  },
  image: {
    marginVertical: 8,
    borderRadius: 10,
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginVertical: 8,
  },
  th: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontWeight: "700" as const,
    fontSize: 14,
    color: Colors.primaryDark,
  },
  td: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
};

type Props = {
  content: string;
};

export default function MarkdownRenderer({ content }: Props) {
  return (
    <Markdown style={markdownStyles}>
      {content}
    </Markdown>
  );
}
