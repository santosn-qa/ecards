# AI Release Checklist

## Automated checks

- [ ] `npm run build`
- [ ] `npm run test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test:e2e`

## Browser smoke

- [ ] Home loads
- [ ] Design can be selected
- [ ] Card fields can be completed
- [ ] Preview reflects card data
- [ ] URL is generated and reconstructs a card (when implemented)
- [ ] PNG downloads (when implemented)

## PWA and compatibility

- [ ] Service worker registers
- [ ] Application shell and bundled templates cache
- [ ] Offline startup works after first load
- [ ] Valid, malformed, missing-template, and unsupported-schema URLs are safe
  (when URL cards are implemented)
- [ ] At least one mobile viewport is verified

Do not deploy while a required check is failing or a known critical defect is
unresolved. Surface architectural, privacy, compatibility, or UX decisions for
human approval.
