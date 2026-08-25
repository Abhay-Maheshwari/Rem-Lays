# Plan: Center Align Card Tags

## Context & Problem
In the feed item cards, the body text is center-aligned (`text-align: center`), but the tags container (`.tags-container`) is left-aligned (`display: flex; flex-wrap: wrap; align-items: center;`). This creates visual asymmetry where centered text sits directly above left-aligned tag chips.

## Goals
- Center-align tag chips (`.tags-container`) horizontally within item cards.
- Ensure the edit/add tag buttons and empty tag states are also centered.

## Tasks Breakdown
1. **Task 1: Update `.tags-container` in `src/app/components/item-card/item-card.component.scss`**
   - Add `justify-content: center;` to `.tags-container`.
2. **Task 2: Build & Verification**
   - Run `npm run build` to ensure clean compilation.
   - Verify that tags inside text cards, link cards, media cards, and empty tag states are all centered horizontally.
