import os

FOLDERS = [
    ".idea",
    ".vscode",
    "node_modules",
    ".metro-cache",
    ".gradle",
    "android\\.gradle",
    "android\\build",
    "android\\app\\build",
    "android\\.cxx",
    "android\\app\\.cxx",
    "ios\\build",
    "build",
    "dist",
    ".expo",
    ".expo-shared",
    ".turbo",
    ".parcel-cache",
    ".firebase",
    ".agents",
    ".artifacts",
    ".cache",
]

for folder in FOLDERS:
    if os.path.exists(folder):
        print(f"Deleting {folder}...")
        os.system(f'cmd /c rmdir /s /q "{folder}"')
        print(f"Done: {folder}")
    else:
        print(f"Not found: {folder}")

print("\nCleanup completed.")