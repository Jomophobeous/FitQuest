# Responsive QA Matrix (P2)

Last updated: 2026-02-17
Owner: Mobile QA / Product Engineering

## Coverage classes (15)
1. Small phone portrait
2. Small phone landscape
3. Medium phone portrait
4. Medium phone landscape
5. Large phone portrait
6. Large phone landscape
7. XL phone portrait
8. XL phone landscape
9. Small tablet portrait
10. Small tablet landscape
11. Medium tablet portrait
12. Medium tablet landscape
13. Large tablet portrait
14. Large tablet landscape
15. Foldable / split-window profile

## Critical screens to validate
- Dashboard
- FitQuest / workout flow
- Move
- Meal Prep
- Profile
- Legal Center
- Backups
- Login/Register
- FitMind Library
- FitMind Reader

## Validation checklist per class
- [ ] No clipped headers or action buttons
- [ ] Primary CTA visible above fold
- [ ] Scrollable regions do not trap gestures
- [ ] Text remains legible at default scale
- [ ] Modal actions remain tappable
- [ ] Safe-area insets respected
- [ ] Landscape keeps core actions accessible

## Orientation checks
- [ ] Portrait → landscape preserves state
- [ ] Landscape → portrait preserves state
- [ ] No crash/re-render loops during rotation

## Localization checks
- [ ] Long-string locale does not truncate critical actions
- [ ] Legal and consent labels remain readable
- [ ] Numeric/date formats remain coherent

## Sign-off
- [ ] QA lead sign-off
- [ ] Product sign-off
- [ ] Engineering sign-off
