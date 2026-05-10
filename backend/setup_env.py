# =============================================================================
# setup_env.py — XCalibr Backend Environment Setup (Week 9)
# =============================================================================
# PURPOSE:
#   One-command setup script that installs ALL Python dependencies programmatically.
#   Run this instead of manually pip-installing individual packages.
#
# USAGE:
#   python setup_env.py
#
# This script:
#   1. Checks Python version (3.9+ required)
#   2. Upgrades pip to latest
#   3. Installs all packages from requirements.txt using subprocess
#   4. Verifies critical imports are loadable
#   5. Prints a success summary
#
# NOTE: If running inside a system Python (no venv), the --break-system-packages
#       flag is automatically added to bypass PEP 668 restrictions.
# =============================================================================

import subprocess
import sys
import importlib
import os

# ─── Package manifest ─────────────────────────────────────────────────────────
# All packages defined here as code — no manual pip commands needed.
PACKAGES = [
    # Web Framework
    "fastapi==0.111.0",
    "uvicorn[standard]==0.29.0",
    "python-multipart==0.0.9",
    "starlette==0.37.2",

    # Database
    "sqlalchemy==2.0.30",
    "psycopg2-binary==2.9.9",

    # Auth / Security
    "passlib[bcrypt]==1.7.4",
    "python-jose[cryptography]==3.3.0",
    "bcrypt==4.1.3",

    # Pydantic / Settings (pinned compatible versions — prevents validate_core_schema error)
    "pydantic==2.7.1",
    "pydantic-core==2.18.4",
    "pydantic[email]==2.7.1",
    "pydantic-settings==2.3.0",
    "email-validator==2.1.1",

    # Environment
    "python-dotenv==1.0.1",

    # AI / LLM — LangChain community stack
    "langchain==0.2.1",
    "langchain-community==0.2.1",
    "langchain-core==0.2.5",
    "langchain-ollama==0.1.1",
    "openai==1.30.1",

    # Document Parsing
    "pypdf==4.2.0",
    "docx2txt==0.8",

    # HTTP Clients
    "requests==2.32.3",
    "httpx==0.27.0",

    # Utilities
    "python-dateutil==2.9.0",
]

# ─── Critical imports to verify after install ─────────────────────────────────
VERIFY_IMPORTS = [
    ("fastapi",          "FastAPI"),
    ("uvicorn",          "Uvicorn"),
    ("sqlalchemy",       "SQLAlchemy"),
    ("jose",             "python-jose"),
    ("passlib",          "Passlib"),
    ("pydantic",         "Pydantic"),
    ("dotenv",           "python-dotenv"),
    ("langchain",        "LangChain"),
    ("langchain_community", "LangChain Community"),
    ("langchain_ollama", "LangChain Ollama"),
    ("pypdf",            "PyPDF"),
    ("docx2txt",         "docx2txt"),
    ("requests",         "Requests"),
    ("httpx",            "HTTPX"),
]


def check_python_version():
    """Ensure Python 3.9 or higher is being used."""
    major, minor = sys.version_info[:2]
    if major < 3 or (major == 3 and minor < 9):
        print(f"❌ Python 3.9+ required. You have {major}.{minor}.")
        sys.exit(1)
    print(f"✅ Python {major}.{minor} detected.")


def upgrade_pip():
    """Upgrade pip to latest version to avoid resolver issues."""
    print("\n📦 Upgrading pip…")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--upgrade", "pip",
         "--break-system-packages"],
        stdout=subprocess.DEVNULL
    )
    print("   pip upgraded.")


def install_packages():
    """Install all packages programmatically with break-system-packages flag."""
    print(f"\n📥 Installing {len(PACKAGES)} packages…\n")
    failed = []

    for pkg in PACKAGES:
        label = pkg.split("==")[0].split("[")[0]  # e.g. "fastapi" from "fastapi==0.111.0"
        print(f"   Installing {label}…", end="", flush=True)
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", pkg,
                 "--break-system-packages", "--quiet"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print(" ✓")
        except subprocess.CalledProcessError:
            print(" ✗ FAILED")
            failed.append(pkg)

    return failed


def verify_imports():
    """Try importing each critical package to confirm installation."""
    print("\n🔍 Verifying imports…\n")
    ok, fail = [], []

    for module, label in VERIFY_IMPORTS:
        try:
            importlib.import_module(module)
            print(f"   ✅ {label}")
            ok.append(label)
        except ImportError:
            print(f"   ❌ {label} — import failed!")
            fail.append(label)

    return ok, fail


def main():
    print("=" * 60)
    print("  XCalibr Backend — Environment Setup (Week 9)")
    print("=" * 60)

    # 1. Python version check
    check_python_version()

    # 2. Upgrade pip
    upgrade_pip()

    # 3. Install all packages
    failed_installs = install_packages()

    # 4. Verify imports
    ok_imports, failed_imports = verify_imports()

    # 5. Summary
    print("\n" + "=" * 60)
    print("  Setup Summary")
    print("=" * 60)
    print(f"  Packages attempted : {len(PACKAGES)}")
    print(f"  Install failures   : {len(failed_installs)}")
    print(f"  Import verifications passed : {len(ok_imports)}/{len(VERIFY_IMPORTS)}")

    if failed_installs:
        print(f"\n  ⚠ Failed installs:")
        for p in failed_installs:
            print(f"    - {p}")

    if failed_imports:
        print(f"\n  ⚠ Failed imports:")
        for i in failed_imports:
            print(f"    - {i}")

    if not failed_installs and not failed_imports:
        print("\n  ✅ All dependencies installed and verified!")
        print("\n  To start the backend:")
        print("    cd backend")
        print("    uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    else:
        print("\n  ⚠ Some packages failed. Check the errors above.")
        print("  Try running:  pip install -r requirements.txt --break-system-packages")

    print("=" * 60)


if __name__ == "__main__":
    main()
