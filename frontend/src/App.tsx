import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GameSetup from './pages/GameSetup'
import GameStatistics from './pages/GameStatistics'
import GameReport from './pages/GameReport'
import TeamManagement from './pages/TeamManagement'
import TeamsList from './pages/TeamsList'
import GamesList from './pages/GamesList'
import Statistics from './pages/Statistics'
import PlayByPlay from './pages/PlayByPlay'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<GameSetup />} />
        <Route path="/game/:gameId" element={<GameStatistics />} />
        <Route path="/game/:gameId/report" element={<GameReport />} />
        <Route path="/game/:gameId/play-by-play" element={<PlayByPlay />} />
        <Route path="/team/new" element={<TeamManagement />} />
        <Route path="/team/:teamId/edit" element={<TeamManagement />} />
        <Route path="/teams" element={<TeamsList />} />
        <Route path="/games" element={<GamesList />} />
        <Route path="/statistics" element={<Statistics />} />
      </Routes>
    </Router>
  )
}

export default App

