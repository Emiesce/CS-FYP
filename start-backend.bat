@echo off
echo Starting AI Grading System backends...
echo.
echo Starting Grading API on port 5000...
start "Grading API" cmd /k "python grading_api.py"

timeout /t 2 /nobreak >nul

echo Starting File Storage API on port 5001...
start "File Storage API" cmd /k "python lecture_notes_file_api.py"

echo.
echo Both backends started in separate windows.
echo - Grading API:      http://localhost:5000
echo - File Storage API: http://localhost:5001
echo.
echo Now run: npm run dev
pause
