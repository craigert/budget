# BudgetSparrow — agent rules

## Git push target

**Only push to `craigert` remote.** Do not push to `origin`
(`Ravinia7212/BudgetSparrow`). Use:

```
git push craigert main
```

…even when a fresh commit lands. If a rebase is needed to fast-forward, pull
from `craigert` (`git pull --rebase craigert main`), not `origin`.

Cloudflare deploys from `github.com/craigert/budget` via the
`.github/workflows/deploy.yml` workflow. `Ravinia7212/BudgetSparrow` is a
historical mirror only.
