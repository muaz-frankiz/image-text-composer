"use client";
import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";

interface GoogleFont {
  kind: string;
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
}

interface GoogleFontsResponse {
  kind: string;
  items: GoogleFont[];
}

interface ImageCanvas {
  objects: string;
  background: string | null;
}

export default function CanvasEditor() {
  // refs
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const imgOriginal = useRef<{ width: number; height: number } | null>(null);
  const backgroundRef = useRef<string | null>(null); // store background image src

  // undo redo stacks
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const isRestoring = useRef(false);
  const MAX_HISTORY = 20;

  // states

  // stack and background
  const [hasBackground, setHasBackground] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // text layer
  const [activeText, setActiveText] = useState<fabric.Textbox | null>(null);
  const [textValue, setTextValue] = useState("");
  const [fontSize, setFontSize] = useState("32");
  const [color, setColor] = useState("#000000");
  const [opacity, setOpacity] = useState(1);
  const [activeFont, setActiveFont] = useState("Arial");
  const [activeFontWeight, setActiveFontWeight] = useState("normal");
  const [activeTextAlign, setActiveTextAlign] = useState("left");

  // fonts
  const [fonts, setFonts] = useState<string[]>([]);
  const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  // use effects

  // Initialize canvas
  useEffect(() => {
    if (!canvasEl.current || canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasEl.current, {
      preserveObjectStacking: true,
      selection: true,
    });
    canvasRef.current = canvas;

    // Listen for active object changes
    canvas.on("selection:created", (e) => {
      if (e.selected && e.selected[0] instanceof fabric.Textbox) {
        setActiveText(e.selected[0]);
      }
    });
    canvas.on("selection:updated", (e) => {
      if (e.selected && e.selected[0] instanceof fabric.Textbox) {
        setActiveText(e.selected[0]);
      }
    });
    canvas.on("selection:cleared", () => {
      setActiveText(null);
    });

    // Record history on modification
    canvas.on("object:modified", saveHistory);
    canvas.on("object:added", saveHistory);
    canvas.on("object:removed", saveHistory);

    // Snap to center
    canvas.on("object:moving", (e) => {
      const obj = e.target;
      if (!obj) return;

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const objCenter = obj.getCenterPoint();

      // Snap threshold
      const threshold = 5;

      // Horizontal snap
      if (Math.abs(objCenter.x - canvasWidth / 2) < threshold) {
        obj.set({
          left: canvasWidth / 2 - obj.getScaledWidth() / 2,
        });
      }

      // Vertical snap
      if (Math.abs(objCenter.y - canvasHeight / 2) < threshold) {
        obj.set({
          top: canvasHeight / 2 - obj.getScaledHeight() / 2,
        });
      }
    });

    // Keyboard nudge
    const handleKey = (e: KeyboardEvent) => {
      if (!canvas.getActiveObject()) return;
      const obj = canvas.getActiveObject();
      if (!obj) return;

      const step = e.shiftKey ? 10 : 1;
      let moved = false;

      switch (e.key) {
        case "ArrowUp":
          obj.top = (obj.top || 0) - step;
          moved = true;
          break;
        case "ArrowDown":
          obj.top = (obj.top || 0) + step;
          moved = true;
          break;
        case "ArrowLeft":
          obj.left = (obj.left || 0) - step;
          moved = true;
          break;
        case "ArrowRight":
          obj.left = (obj.left || 0) + step;
          moved = true;
          break;
      }

      if (moved) {
        obj.setCoords();
        canvas.renderAll();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKey);

    // Restore saved state (AFTER canvas init)
    const saved = localStorage.getItem("canvasDesign");
    if (saved) {
      const { background, objects } = JSON.parse(saved);

      const load = async () => {
        // Restore objects
        if (objects) {
          await canvas.loadFromJSON(objects);
        }

        // Restore background
        if (background) {
          const img = await fabric.FabricImage.fromURL(background);

          const maxWidth = 600;
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;

          canvas.setDimensions({
            width: img.width * scale,
            height: img.height * scale,
          });

          img.set({
            originX: "left",
            originY: "top",
            left: 0,
            top: 0,
            scaleX: scale,
            scaleY: scale,
          });

          canvas.backgroundImage = img;
          backgroundRef.current = background;
          setHasBackground(true);
        }
        canvas.requestRenderAll();

        // Save initial state into undo stack
        const json = JSON.stringify(canvas.toJSON());
        undoStack.current.push(json);
      };

      load();
      updateStackStates();
    }

    return () => {
      window.removeEventListener("keydown", handleKey);
      canvas.dispose();
    };
  }, []);

  // Set default text properties
  useEffect(() => {
    if (activeText) {
      setTextValue(activeText.text ?? "");
      setFontSize(String(activeText.fontSize ?? 16));
      setColor(activeText.fill?.toString() ?? "#000000");
      setOpacity(activeText.opacity ?? 1);
      setActiveFontWeight(activeText.fontWeight?.toString() || "normal");
      setActiveTextAlign(activeText.textAlign || "left");
    }
  }, [activeText]);

  // Load Google Fonts list (from API)
  useEffect(() => {
    async function loadFonts() {
      try {
        const res = await fetch(
          `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_API_KEY}`
        );
        const data: GoogleFontsResponse = await res.json();
        const fontNames = data.items.map((f) => f.family);
        setFonts(fontNames);
      } catch (err) {
        console.error("Error loading fonts:", err);
      }
    }
    loadFonts();
  }, [GOOGLE_API_KEY]);

  // load font
  async function loadFont(fontFamily: string) {
    const linkId = `gf-${fontFamily.replace(/\s+/g, "-")}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(
        /\s+/g,
        "+"
      )}&display=swap`;
      document.head.appendChild(link);
    }

    try {
      await document.fonts.load(`16px "${fontFamily}"`);
      console.log(`${fontFamily} loaded`);
    } catch (err) {
      console.error(`Failed to load font ${fontFamily}`, err);
    }
  }

  // stack states
  const updateStackStates = () => {
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(redoStack.current.length > 0);
  };

  // saving and loading
  const saveHistory = () => {
    if (isRestoring.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const snapshot = JSON.stringify({
      objects: canvas.toJSON(),
      background: backgroundRef.current,
    });
    undoStack.current.push(snapshot);

    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }

    // save to localStorage
    localStorage.setItem("canvasDesign", snapshot);

    updateStackStates();
  };

  const loadSnapshot = async (canvas: fabric.Canvas, snapshot: ImageCanvas) => {
    isRestoring.current = true;

    const { objects, background } = snapshot;

    // restore objects
    if (objects) {
      await canvas.loadFromJSON(objects);
    }

    // restore background
    if (background) {
      const img = await fabric.FabricImage.fromURL(background);

      const maxWidth = 600;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;

      canvas.setDimensions({
        width: img.width * scale,
        height: img.height * scale,
      });

      img.set({
        originX: "left",
        originY: "top",
        left: 0,
        top: 0,
        scaleX: scale,
        scaleY: scale,
      });

      canvas.backgroundImage = img;
      backgroundRef.current = background;
      setHasBackground(true);
    } else {
      backgroundRef.current = null;
      setHasBackground(false);
      canvas.backgroundImage = undefined;
    }

    canvas.requestRenderAll();

    setTimeout(() => {
      isRestoring.current = false;
    }, 0);
  };

  // undo redo reset
  const undo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const current = undoStack.current.pop() as string; // remove current
    redoStack.current.push(current);

    if (redoStack.current.length > MAX_HISTORY) {
      redoStack.current.shift();
    }

    const prev = JSON.parse(undoStack.current[undoStack.current.length - 1]);
    await loadSnapshot(canvas, prev);

    updateStackStates();
  };

  const redo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStack.current.length === 0) return;

    const snapshot = redoStack.current.pop() as string;
    undoStack.current.push(snapshot);

    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }

    const next = JSON.parse(snapshot);
    await loadSnapshot(canvas, next);

    updateStackStates();
  };

  const reset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.clear();
    backgroundRef.current = null;
    setHasBackground(false);
    undoStack.current = [];
    redoStack.current = [];
    localStorage.removeItem("canvasDesign");
    updateStackStates();

    canvas.requestRenderAll();
  };

  // image upload and export
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (f) => {
      const src = f.target?.result as string | undefined;
      if (!src) return;

      try {
        const img = await fabric.FabricImage.fromURL(src);
        const canvas = canvasRef.current;
        if (!canvas) return;

        imgOriginal.current = { width: img.width, height: img.height };
        backgroundRef.current = src;
        setHasBackground(true);

        canvas.clear();

        const maxWidth = 600;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;

        canvas.setDimensions({
          width: img.width * scale,
          height: img.height * scale,
        });

        img.set({
          originX: "left",
          originY: "top",
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale,
        });

        canvas.backgroundImage = img;

        const snapshot = JSON.stringify({
          objects: canvas.toJSON(),
          background: backgroundRef.current,
        });

        // save to localStorage
        localStorage.setItem("canvasDesign", snapshot);

        canvas.requestRenderAll();
      } catch (err) {
        console.error("Error loading image:", err);
      }
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleExport = async () => {
    const canvas = canvasRef.current;
    const original = imgOriginal.current;
    if (!canvas || !original) return;

    const exportCanvas = document.createElement("canvas");
    const exportFabric = new fabric.Canvas(exportCanvas);

    const scaleX = original.width / canvas.getWidth();
    const scaleY = original.height / canvas.getHeight();

    for (const obj of canvas.getObjects()) {
      const cloned = await obj.clone();
      if (cloned) {
        cloned.scaleX = (cloned.scaleX ?? 1) * scaleX;
        cloned.scaleY = (cloned.scaleY ?? 1) * scaleY;
        cloned.left = (cloned.left ?? 0) * scaleX;
        cloned.top = (cloned.top ?? 0) * scaleY;
        exportFabric.add(cloned);
      }
    }

    exportFabric.setDimensions({
      width: original.width,
      height: original.height,
    });

    if (canvas.backgroundImage) {
      const bg = canvas.backgroundImage as fabric.FabricImage;
      const bgImg = await fabric.FabricImage.fromURL(bg.getSrc());

      exportFabric.backgroundImage = bgImg;
      exportFabric.requestRenderAll();
    }

    const dataURL = exportFabric.toDataURL({
      multiplier: 1,
      format: "png",
      quality: 1,
    });

    // Trigger download
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "export.png";
    link.click();
  };

  const addText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const text = new fabric.Textbox("Edit me", {
      left: 50,
      top: 50,
      fontSize: 32,
      fill: "#000000",
      editable: true,
      textAlign: "left",
      fontWeight: "normal",
      width: 200, // allow wrapping for multi-line editing
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    setActiveText(text);

    // saveHistory();
    canvas.requestRenderAll();
  };

  const updateText = async (
    prop: keyof fabric.Textbox,
    value: string | number
  ) => {
    if (!activeText) return;

    activeText.set(prop, value);

    if (prop === "fontSize" && typeof value === "number") {
      setFontSize(String(value));
    }

    canvasRef.current?.requestRenderAll();
    saveHistory();
  };

  const deleteText = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeText) return;
    canvas.remove(activeText);
    setActiveText(null);
    canvas.requestRenderAll();
  };

  // Layer ordering
  const bringForward = () => {
    if (activeText) {
      canvasRef.current?.bringObjectForward(activeText);
      canvasRef.current?.requestRenderAll();
    }
  };

  const sendBackward = () => {
    if (activeText) {
      canvasRef.current?.sendObjectBackwards(activeText);
      canvasRef.current?.requestRenderAll();
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Controls Sidebar */}
      <div className="flex flex-col gap-4 w-60 p-4 bg-white rounded shadow">
        <label
          htmlFor="fileUpload"
          className={`px-3 py-1 rounded text-center cursor-pointer 
    text-white transition-colors
    ${
      hasBackground
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-purple-600 hover:bg-purple-700"
    }`}
        >
          Upload Background
        </label>
        <input
          type="file"
          accept="image/png"
          disabled={hasBackground}
          onChange={handleUpload}
          style={{ display: "none" }}
          id="fileUpload"
        />

        <button
          onClick={addText}
          disabled={!hasBackground}
          className="px-3 py-1 rounded text-white 
             bg-blue-600 hover:bg-blue-700 
             disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Add Text
        </button>

        <button
          onClick={handleExport}
          disabled={!hasBackground}
          className="px-3 py-1 rounded text-white 
             bg-green-600 hover:bg-green-700 
             disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Export PNG
        </button>

        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`px-3 py-1.5 rounded-lg font-medium transition 
    ${
      canUndo
        ? "bg-gray-200 hover:bg-gray-300 text-gray-800"
        : "bg-gray-300 text-gray-500 cursor-not-allowed"
    }`}
          >
            Undo
          </button>

          <button
            onClick={redo}
            disabled={!canRedo}
            className={`ml-2 px-3 py-1.5 rounded-lg font-medium transition 
    ${
      canRedo
        ? "bg-gray-200 hover:bg-gray-300 text-gray-800"
        : "bg-gray-300 text-gray-500 cursor-not-allowed"
    }`}
          >
            Redo
          </button>
          <button
            onClick={reset}
            disabled={!hasBackground}
            className={`px-3 py-1 rounded text-white font-medium transition-colors
    ${
      hasBackground
        ? "bg-red-500 hover:bg-red-600"
        : "bg-gray-400 cursor-not-allowed"
    }`}
          >
            Reset
          </button>
        </div>

        {activeText && (
          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm">Text</label>
            <input
              type="text"
              value={textValue}
              onChange={(e) => {
                setTextValue(e.target.value);
                updateText("text", e.target.value);
              }}
              className="border p-1 rounded"
            />

            <label className="text-sm">Font Size</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => {
                const val = e.target.value;
                setFontSize(val);

                const num = parseInt(val, 10);
                if (!isNaN(num)) {
                  updateText("fontSize", num);
                }
              }}
              className="border p-1 rounded"
            />

            <label className="text-sm">Font Family</label>
            <select
              value={activeFont}
              onChange={async (e) => {
                const font = e.target.value;
                setActiveFont(font); // update state
                await loadFont(font); // load font dynamically
                updateText("fontFamily", font);
              }}
              className="border p-1 rounded"
            >
              {fonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>

            <label className="text-sm">Font Weight</label>
            <select
              value={activeFontWeight}
              onChange={(e) => {
                const weight = e.target.value;
                setActiveFontWeight(weight);
                if (activeText) {
                  activeText.set("fontWeight", weight);
                  canvasRef.current?.requestRenderAll();
                }
              }}
              className="border p-1 rounded"
            >
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>

            <label className="text-sm">Alignment</label>
            <select
              value={activeTextAlign}
              onChange={(e) => {
                const align = e.target.value as
                  | "left"
                  | "center"
                  | "right"
                  | "justify";
                setActiveTextAlign(align);
                if (activeText) {
                  activeText.set("textAlign", align);
                  canvasRef.current?.requestRenderAll();
                }
              }}
              className="border p-1 rounded"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>

            <label className="text-sm">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                updateText("fill", e.target.value);
              }}
              className="border p-1 rounded"
            />

            <label className="text-sm">Opacity</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setOpacity(val);
                updateText("opacity", val);
              }}
            />

            <div className="flex gap-2 mt-2">
              <button
                onClick={bringForward}
                className="px-2 py-1 bg-gray-200 rounded"
              >
                ↑
              </button>
              <button
                onClick={sendBackward}
                className="px-2 py-1 bg-gray-200 rounded"
              >
                ↓
              </button>
              <button
                onClick={deleteText}
                className="px-2 py-1 bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center bg-gray-100 p-4 rounded">
        <canvas ref={canvasEl} className="border shadow-md" />
      </div>
    </div>
  );
}

