package com.enterprise.collab.service;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Message Formatting Service - Converts markdown to HTML
 */
@Service
public class MessageFormatterService {

    private static final Pattern BOLD_PATTERN = Pattern.compile("\\*\\*(.+?)\\*\\*");
    private static final Pattern ITALIC_PATTERN = Pattern.compile("\\*(.+?)\\*");
    private static final Pattern CODE_PATTERN = Pattern.compile("`(.+?)`");
    private static final Pattern LINK_PATTERN = Pattern.compile("\\[([^\\]]+)\\]\\(([^)]+)\\)");
    private static final Pattern MENTION_PATTERN = Pattern.compile("@(\\w+)");
    private static final Pattern EMOJI_PATTERN = Pattern.compile(":([a-zA-Z0-9_+-]+):");

    private static final Map<String, String> EMOJI_MAP = new HashMap<>();
    
    static {
        EMOJI_MAP.put("smile", "😊");
        EMOJI_MAP.put("laugh", "😂");
        EMOJI_MAP.put("heart", "❤️");
        EMOJI_MAP.put("thumbsup", "👍");
        EMOJI_MAP.put("thumbsdown", "👎");
        EMOJI_MAP.put("check", "✅");
    }

    public String formatMessage(String content) {
        if (content == null || content.isEmpty()) {
            return content;
        }
        
        content = processBold(content);
        content = processItalic(content);
        content = processCode(content);
        content = processLinks(content);
        content = processEmoji(content);
        content = processMentions(content);
        
        return content;
    }

    private String processBold(String s) {
        Matcher m = BOLD_PATTERN.matcher(s);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, "<strong>" + m.group(1) + "</strong>");
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String processItalic(String s) {
        Matcher m = ITALIC_PATTERN.matcher(s);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, "<em>" + m.group(1) + "</em>");
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String processCode(String s) {
        Matcher m = CODE_PATTERN.matcher(s);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, "<code>" + m.group(1) + "</code>");
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String processLinks(String s) {
        Matcher m = LINK_PATTERN.matcher(s);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, "<a href=\"" + m.group(2) + "\" target=\"_blank\">" + m.group(1) + "</a>");
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String processMentions(String s) {
        Matcher m = MENTION_PATTERN.matcher(s);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            m.appendReplacement(sb, "<span class=\"mention\">@" + m.group(1) + "</span>");
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String processEmoji(String s) {
        Matcher m = EMOJI_PATTERN.matcher(s);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String emoji = EMOJI_MAP.get(m.group(1));
            if (emoji != null) {
                m.appendReplacement(sb, emoji);
            }
        }
        m.appendTail(sb);
        return sb.toString();
    }
}
