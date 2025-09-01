import logo from './logo.svg';
import './App.css';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import Home from './Home/Home';
import Fingerprint from './Fingerprint/Fingerprint';
import Facial from './Facial/FaceAuth';
import Enrollment from './Enrollment/Enrollment';
import VoiceAuth from './Voice/VoiceAuth';
function App() {
 const router = createBrowserRouter([
  {path:'/',element:<Home/>},
  {path:'/enroll',element:<Enrollment/> },
  {path:'/home',element:<Home/>},
  {path:'/fingerprint',element:<Fingerprint/>},
  {path:'/facial',element:<Facial/>},
  {path:'/voiceAuth',element:<VoiceAuth/>}

 ])
  
  return (
    <div className="App">
        <RouterProvider router={router}/>
    </div>
  );
}

export default App;
