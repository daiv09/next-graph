# constants.py

GITHUB_API_BASE = "https://api.github.com"

DEPENDENCY_FILES: frozenset[str] = frozenset(
    {
        "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "bun.lockb", "requirements.txt", "requirements.in", "Pipfile",
        "Pipfile.lock", "pyproject.toml", "poetry.lock", "setup.py",
        "setup.cfg", "Gemfile", "Gemfile.lock", "go.mod", "go.sum",
        "Cargo.toml", "Cargo.lock", "composer.json", "composer.lock",
        "pom.xml", "build.gradle", "build.gradle.kts", "pubspec.yaml",
        "pubspec.lock", "mix.exs", "mix.lock", "deps.edn", "project.clj",
        "Package.swift", "*.csproj", "*.fsproj", "*.vbproj", "nuget.config",
        "packages.config",
    }
)

DEPENDENCY_PATTERNS: tuple[str, ...] = (".csproj", ".fsproj", ".vbproj")