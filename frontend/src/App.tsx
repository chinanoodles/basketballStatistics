import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Home from './pages/Home'
import GameSetup from './pages/GameSetup'
import GameStatistics from './pages/GameStatistics'
import GameReport from './pages/GameReport'
import TeamManagement from './pages/TeamManagement'
import TeamsList from './pages/TeamsList'
import GamesList from './pages/GamesList'
import Statistics from './pages/Statistics'
import PlayByPlay from './pages/PlayByPlay'
import LeagueManagement from './pages/LeagueManagement'
import UserManagement from './pages/UserManagement'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <GameSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:gameId"
            element={
              <ProtectedRoute>
                <GameStatistics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:gameId/report"
            element={
              <ProtectedRoute>
                <GameReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game/:gameId/play-by-play"
            element={
              <ProtectedRoute>
                <PlayByPlay />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/new"
            element={
              <ProtectedRoute>
                <TeamManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team/:teamId/edit"
            element={
              <ProtectedRoute>
                <TeamManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <TeamsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/games"
            element={
              <ProtectedRoute>
                <GamesList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <ProtectedRoute>
                <Statistics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leagues"
            element={
              <ProtectedRoute requireAdmin>
                <LeagueManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requireAdmin>
                <UserManagement />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

