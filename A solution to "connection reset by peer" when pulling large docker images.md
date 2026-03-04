---
date: 2026-03-04T21:10:00
updated: 2026-03-04T21:15:00
title: A solution to "connection reset by peer" when pulling large docker images
---
I was trying to pull the `vllm` docker image which is really a huge one with >10gb size. It always failed in the middle of downloading the biggest layer. I googled, gpt-ed, gemini-ed and none of the solutions worked. And I finally figured that out by myself.

Essentially, it's not very relevant to it's using ipv4 or ipv6. The root cause is that the downloading from the biggest (or several big) layer will get timeout. To resolve that, some system settings need to be adjusted:

```
sudo sysctl -w net.ipv4.tcp_keepalive_time=1800 # or to sth. reasonable on your machine
sudo sysctl -w net.ipv4.tcp_keepalive_intvl=60
sudo sysctl -w net.ipv4.tcp_keepalive_probes=20
```

But ofc the above settings assume you are using ipv4 on your machine. Hopefully that may help. Cheers. 