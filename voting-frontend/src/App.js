import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home/Home';
import Fingerprint from './Fingerprint/Fingerprint';
import Facial from './Facial/FaceAuth';
import Enrollment from './Enrollment/Enrollment';
import VoiceAuth from './Voice/VoiceAuth';
import VoiceEnroll from './Enrollment/Voice_enroll';

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/enroll" element={<Enrollment />} />
          <Route path="/fingerprint" element={<Fingerprint />} />
          <Route path="/facial" element={<Facial />} />
          <Route path="/voiceAuth" element={<VoiceAuth />} />
          <Route path="/voice-enroll" element={<VoiceEnroll />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
