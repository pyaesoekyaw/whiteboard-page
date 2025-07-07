import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client'; // Import Socket.IO client library

// Main App component
const App = () => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const socketRef = useRef(null); // Ref for Socket.IO client

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);

  // Backend URL for Socket.IO connection
  // This will be set by Jenkins pipeline during build using REACT_APP_BACKEND_URL environment variable
  // For local development, it defaults to localhost
  const BACKEND_URL = typeof process !== 'undefined' && process.env.REACT_APP_BACKEND_URL ? process.env.REACT_APP_BACKEND_URL : 'http://localhost:3001';

  useEffect(() => {
    const canvas = canvasRef.current;
    // Set canvas dimensions to be responsive
    canvas.width = window.innerWidth * 0.8; // 80% of window width
    canvas.height = window.innerHeight * 0.7; // 70% of window height

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    // Initial setup of strokeStyle and lineWidth
    context.strokeStyle = brushColor;
    context.lineWidth = brushSize;
    contextRef.current = context;

    // Initialize Socket.IO client
    socketRef.current = io(BACKEND_URL);

    // Event listener for receiving drawing data from other clients
    socketRef.current.on('drawing', (data) => {
      const { x0, y0, x1, y1, color, size } = data;
      const currentContext = contextRef.current;
      if (currentContext) {
        // Ensure stroke style and width are set for the incoming segment
        currentContext.strokeStyle = color;
        currentContext.lineWidth = size;
        currentContext.beginPath(); // Start a new path for this segment
        currentContext.moveTo(x0, y0); // Move to the start of this segment
        currentContext.lineTo(x1, y1); // Draw to the end of this segment
        currentContext.stroke(); // Render this segment
      }
    });

    // Cleanup function for Socket.IO
    return () => {
      socketRef.current.disconnect();
    };
  }, []); // Empty dependency array means this runs once on mount

  // Update context properties when brushColor or brushSize changes
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = brushColor;
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushColor, brushSize]); // Dependencies added here

  // Function to start drawing
  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    // Store the initial point for the current stroke
    contextRef.current.canvas.lastX = offsetX;
    contextRef.current.canvas.lastY = offsetY;
  };

  // Function to stop drawing
  const finishDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
    // Explicitly reset last drawn coordinates to prevent unintended connections
    contextRef.current.canvas.lastX = undefined;
    contextRef.current.canvas.lastY = undefined;
  };

  // Function to draw
  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;

    const x0 = contextRef.current.canvas.lastX;
    const y0 = contextRef.current.canvas.lastY;

    // Only draw if we have a valid previous point from the current stroke
    if (x0 !== undefined && y0 !== undefined) {
      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();

      // Emit drawing data to the server
      socketRef.current.emit('drawing', {
        x0,
        y0,
        x1: offsetX,
        y1: offsetY,
        color: brushColor,
        size: brushSize,
      });
    }

    // Update the current point to be the previous point for the next segment
    contextRef.current.canvas.lastX = offsetX;
    contextRef.current.canvas.lastY = offsetY;
  };

  // Function to clear the canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    // Emit clear event to other clients
    socketRef.current.emit('clearCanvas');
  };

  // Event listener for receiving clear canvas command from other clients
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on('clearCanvas', () => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }, []);


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center justify-center p-4 font-inter">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200 mb-6">
        <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-4">
          Real-time Collaborative Whiteboard
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Draw together with friends in real-time!
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          {/* Color Picker */}
          <div className="flex items-center gap-2">
            <label htmlFor="colorPicker" className="text-gray-700 font-medium">Color:</label>
            <input
              type="color"
              id="colorPicker"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-12 h-12 rounded-full border-2 border-gray-300 cursor-pointer"
            />
          </div>

          {/* Brush Size Slider */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="brushSize" className="text-gray-700 font-medium">Size:</label>
            <input
              type="range"
              id="brushSize"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-gray-700 font-bold w-8 text-right">{brushSize}</span>
          </div>

          {/* Clear Canvas Button */}
          <button
            onClick={clearCanvas}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            Clear Canvas
          </button>
        </div>

        {/* Drawing Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseUp={finishDrawing}
          onMouseOut={finishDrawing} // Stop drawing if mouse leaves canvas
          onMouseMove={draw}
          // Add touch events for mobile responsiveness
          onTouchStart={startDrawing}
          onTouchEnd={finishDrawing}
          onTouchCancel={finishDrawing}
          onTouchMove={draw}
          className="bg-white border border-gray-300 rounded-lg shadow-inner cursor-crosshair"
          style={{ touchAction: 'none' }} // Prevent touch scrolling/zooming while drawing
        ></canvas>
      </div>
      <p className="text-gray-500 text-sm mt-4">
        Open this page in multiple browser tabs or on different devices to collaborate!
      </p>
    </div>
  );
};

export default App;
