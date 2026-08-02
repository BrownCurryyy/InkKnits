import React, {useState} from 'react'

export default function App(){
  const [pong, setPong] = useState(null)
  async function ping(){
    try{
      const res = await fetch('/api/health')
      const json = await res.json()
      setPong(JSON.stringify(json))
    }catch(e){
      setPong('error: '+e.message)
    }
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded shadow p-6">
        <h1 className="text-2xl font-bold mb-4">InkKnits — Frontend Dev Shell</h1>
        <p className="text-sm text-gray-600 mb-4">This is a small dev frontend to exercise the backend API.</p>
        <button onClick={ping} className="px-4 py-2 bg-blue-600 text-white rounded">Ping backend</button>
        <div className="mt-4 text-sm text-gray-800">Response: <pre className="whitespace-pre-wrap">{pong}</pre></div>
      </div>
    </div>
  )
}
