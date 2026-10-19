---
title: LPD8 DMX Kit
summary: A kit that turns DJ-event lighting from turning knobs one by one into a single pad press.
status: Done
updated: 2026-10-18
tags: [DMX, MIDI, QLC+]
specs:
  - { l: Pads, v: '8', t: The AKAI LPD8 pads that scenes are assigned to. }
---

## Take it apart.

When I ran the lights at a friend's DJ event, changing the colour and movement to match a track meant turning several knobs on the desk at once. The music doesn't wait, so there were moments my hands couldn't keep up.

## Understand it.

The problem wasn't the number of controls. It was rebuilding the same "combination for this moment" by hand every time. There are only so many moments, and their combinations can be decided in advance.

## Remake it.

I mapped a small MIDI pad controller (AKAI LPD8) to QLC+, which drives the lights over DMX. Each moment's combination is saved as a workspace, and one press of a pad switches to it. I built the whole set-up together with Claude Code.

Version 1.0 is in use at events, and I keep improving it.
