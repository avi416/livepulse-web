@echo off
echo Fixing WatchStream.tsx...
del "src\pages\WatchStream.tsx"
copy "src\pages\WatchStream.tsx.new" "src\pages\WatchStream.tsx"
echo Done!
