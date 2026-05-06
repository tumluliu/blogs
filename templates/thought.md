<%*
const stamp = tp.date.now("YYYY-MM-DD-HHmm");
await tp.file.move("src/content/thoughts/" + stamp);
_%>---
date: <% tp.date.now("YYYY-MM-DDTHH:mm:ssZZ") %>
tags: []
---
<% tp.file.cursor() %>
