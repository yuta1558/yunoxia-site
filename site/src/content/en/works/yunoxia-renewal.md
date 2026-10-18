---
title: Rebuilding this site
summary: Practising "take it apart, understand it, remake it" on this site itself.
status: In progress
updated: 2026-10-18
tags: [Astro, three.js, Design]
---

## Take it apart

The previous site was plain HTML and JavaScript with no build step. The effects had kept multiplying, but I could no longer say what each one was there to communicate.

## Understand it

What I settled first wasn't the technology but the rules. For every effect I wrote down what it communicates, what people who prefer reduced motion see instead, and how much of the performance budget it may use. An effect that can't fill in all three doesn't get built.

## Remake it

The reading pages are static HTML built with Astro, and 3D is limited to the top page and Research. Progress goes into the [Log](/log/) (in Japanese).
