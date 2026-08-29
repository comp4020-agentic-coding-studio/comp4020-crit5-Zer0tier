# Orbital Shield

A small wordless browser action game built for COMP4020 Crit 5. It is a static
HTML, CSS and TypeScript project compiled with Vite and deployed through the
repository's GitHub Pages workflow.

## Development

```sh
pnpm install
pnpm dev
pnpm check
pnpm check:evidence
```

The game rule fixture lives in `spec/crit-5.test.ts`. Browser-only play and
accessibility probes live in `scripts/`; they remain separate because layout,
timing and perceived fairness are not claims jsdom can judge.
