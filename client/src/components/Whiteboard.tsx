import React, { useEffect, useRef, useState } from 'react';
import { Canvas, util, PencilBrush, Rect, Circle, Line, IText, FabricObject } from 'fabric';
import { socket } from '../services/socket';
import jsPDF from 'jspdf';

type Tool = 'select' | 'pencil' | 'rect' | 'circle' | 'line' | 'text' | 'eraser';

const Whiteboard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvas, setCanvas] = useState<Canvas | null>(null);
    const [activeTool, setActiveTool] = useState<Tool>('pencil');
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [fillColor, setFillColor] = useState('transparent');
    const [brushSize, setBrushSize] = useState(5);

    const activeToolRef = useRef<Tool>('pencil');
    const strokeColorRef = useRef('#000000');
    const fillColorRef = useRef('transparent');
    const brushSizeRef = useRef(5);
    const isUndoing = useRef(false);

    const isDrawingShape = useRef(false);
    const startPos = useRef<{ x: number, y: number } | null>(null);
    const activeShape = useRef<FabricObject | null>(null);

    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    useEffect(() => {
        activeToolRef.current = activeTool;
        strokeColorRef.current = strokeColor;
        fillColorRef.current = fillColor;
        brushSizeRef.current = brushSize;

        if (canvas) {
            canvas.isDrawingMode = activeTool === 'pencil';
            canvas.selection = activeTool === 'select';
            canvas.defaultCursor = activeTool === 'text' ? 'text' : 'default';

            if (canvas.freeDrawingBrush) {
                canvas.freeDrawingBrush.color = strokeColor;
                canvas.freeDrawingBrush.width = brushSize;
            }

            canvas.getObjects().forEach((obj) => {
                obj.selectable = activeTool === 'select' || activeTool === 'eraser';
                obj.evented = activeTool === 'select' || activeTool === 'eraser';
            });
            canvas.requestRenderAll();
        }
    }, [activeTool, strokeColor, fillColor, brushSize, canvas]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const newCanvas = new Canvas(canvasRef.current, {
            width: 800,
            height: 600,
            backgroundColor: 'white',
            selection: false,
        });

        setCanvas(newCanvas);
        socket.emit('join-room', 'default-room');

        const brush = new PencilBrush(newCanvas);
        brush.color = strokeColorRef.current;
        brush.width = brushSizeRef.current;
        newCanvas.freeDrawingBrush = brush;

        const initialState = JSON.stringify(newCanvas);
        setHistory([initialState]);
        setHistoryIndex(0);

        newCanvas.on('path:created', (e: any) => {
            if (activeToolRef.current === 'pencil') {
                handleObjectAdded(e.path, newCanvas);
            }
        });

        newCanvas.on('object:added', (e: any) => {
            // This triggers for ALL objects, including those added via socket.
            // We need to distinguish between user actions and socket updates.
            // For now, 'path:created' is good for pencil.
            // For shapes, we'll emit manually after creation.
        });

        newCanvas.on('object:modified', () => {
            saveHistory(newCanvas);
            // TODO: Emit modification event if we want real-time editing of existing objects
        });

        newCanvas.on('mouse:down', (o: any) => handleMouseDown(o, newCanvas));
        newCanvas.on('mouse:move', (o: any) => handleMouseMove(o, newCanvas));
        newCanvas.on('mouse:up', (o: any) => handleMouseUp(o, newCanvas));

        // Socket Listeners
        socket.on('draw', (data: any) => {
            util.enlivenObjects([data.object]).then((objects: any[]) => {
                objects.forEach((o) => {
                    newCanvas.add(o);
                });
                newCanvas.renderAll();
                saveHistory(newCanvas);
            });
        });

        socket.on('clear', () => {
            newCanvas.clear();
            newCanvas.backgroundColor = 'white';
            newCanvas.renderAll();
            saveHistory(newCanvas);
        });

        return () => {
            newCanvas.dispose();
            socket.off('draw');
            socket.off('clear');
        };
    }, []);


    const handleMouseDown = (o: any, cvs: Canvas) => {
        const pointer = cvs.getPointer(o.e);
        startPos.current = { x: pointer.x, y: pointer.y };
        const tool = activeToolRef.current;

        if (tool === 'select') return;

        if (tool === 'eraser') {
            if (o.target) {
                cvs.remove(o.target);
                saveHistory(cvs);
                // TODO: Emit delete event
            }
            return;
        }

        if (tool === 'text') {
            const text = new IText('Type here', {
                left: pointer.x,
                top: pointer.y,
                fill: strokeColorRef.current,
                fontSize: brushSizeRef.current * 4,
            });
            cvs.add(text);
            cvs.setActiveObject(text);
            text.enterEditing();
            handleObjectAdded(text, cvs);
            setActiveTool('select');
            return;
        }

        if (['rect', 'circle', 'line'].includes(tool)) {
            isDrawingShape.current = true;
            let shape: FabricObject | null = null;
            const stroke = strokeColorRef.current;
            const fill = fillColorRef.current === 'transparent' ? '' : fillColorRef.current;
            const size = brushSizeRef.current;

            if (tool === 'rect') {
                shape = new Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 0,
                    height: 0,
                    fill: fill,
                    stroke: stroke,
                    strokeWidth: size,
                    transparentCorners: false
                });
            } else if (tool === 'circle') {
                shape = new Circle({
                    left: pointer.x,
                    top: pointer.y,
                    radius: 0,
                    fill: fill,
                    stroke: stroke,
                    strokeWidth: size,
                    originX: 'center',
                    originY: 'center'
                });
            } else if (tool === 'line') {
                shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                    stroke: stroke,
                    strokeWidth: size,
                });
            }

            if (shape) {
                activeShape.current = shape;
                cvs.add(shape);
            }
        }
    };

    const handleMouseMove = (o: any, cvs: Canvas) => {
        if (!isDrawingShape.current || !activeShape.current || !startPos.current) return;
        const pointer = cvs.getPointer(o.e);
        const tool = activeToolRef.current;

        if (tool === 'rect') {
            const rect = activeShape.current as Rect;
            rect.set({
                width: Math.abs(pointer.x - startPos.current.x),
                height: Math.abs(pointer.y - startPos.current.y),
                left: Math.min(pointer.x, startPos.current.x),
                top: Math.min(pointer.y, startPos.current.y)
            });
        } else if (tool === 'circle') {
            const circle = activeShape.current as Circle;
            const radius = Math.sqrt(Math.pow(pointer.x - startPos.current.x, 2) + Math.pow(pointer.y - startPos.current.y, 2)) / 2;
            circle.set({ radius: radius });
        } else if (tool === 'line') {
            const line = activeShape.current as Line;
            line.set({ x2: pointer.x, y2: pointer.y });
        }

        cvs.renderAll();
    };

    const handleMouseUp = (o: any, cvs: Canvas) => {
        if (isDrawingShape.current && activeShape.current) {
            handleObjectAdded(activeShape.current, cvs);
            activeShape.current = null;
            isDrawingShape.current = false;
        }
    };

    const handleObjectAdded = (obj: FabricObject, cvs: Canvas) => {
        socket.emit('draw', {
            roomId: 'default-room',
            object: obj.toObject(),
        });
        saveHistory(cvs);
    };

    const saveHistory = (c: Canvas) => {
        if (isUndoing.current) return;
        const json = JSON.stringify(c);
        setHistory((prev) => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(json);
            return newHistory;
        });
        setHistoryIndex((prev) => prev + 1);
    };

    const undo = () => {
        if (historyIndex > 0 && canvas) {
            isUndoing.current = true;
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            canvas.loadFromJSON(history[newIndex]).then(() => {
                canvas.renderAll();
                isUndoing.current = false;

                canvas.isDrawingMode = activeToolRef.current === 'pencil';
                canvas.selection = activeToolRef.current === 'select';

                if (canvas.freeDrawingBrush) {
                    canvas.freeDrawingBrush.color = strokeColorRef.current;
                    canvas.freeDrawingBrush.width = brushSizeRef.current;
                }
            });
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1 && canvas) {
            isUndoing.current = true;
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            canvas.loadFromJSON(history[newIndex]).then(() => {
                canvas.renderAll();
                isUndoing.current = false;

                canvas.isDrawingMode = activeToolRef.current === 'pencil';
                canvas.selection = activeToolRef.current === 'select';

                if (canvas.freeDrawingBrush) {
                    canvas.freeDrawingBrush.color = strokeColorRef.current;
                    canvas.freeDrawingBrush.width = brushSizeRef.current;
                }
            });
        }
    };

    const saveImage = () => {
        if (!canvas) return;
        const dataURL = canvas.toDataURL({ format: 'png', multiplier: 1 });
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'whiteboard.png';
        link.click();
    };

    const savePDF = () => {
        if (!canvas) return;
        const imgData = canvas.toDataURL({ format: 'png', multiplier: 1 });
        const pdf = new jsPDF();
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 150);
        pdf.save('whiteboard.pdf');
    };

    const clearCanvas = () => {
        socket.emit('clear', 'default-room');
    };

    return (
        <div className="d-flex flex-column align-items-center position-relative w-100 h-100">
            <div className="glass-panel p-3 mb-3 d-flex gap-3 align-items-center flex-wrap justify-content-center shadow-sm" style={{ borderRadius: '15px', zIndex: 10 }}>

                <div className="btn-group" role="group">
                    <button className={`btn ${activeTool === 'select' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTool('select')} title="Select">Select</button>
                    <button className={`btn ${activeTool === 'pencil' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTool('pencil')} title="Pencil">✏️</button>
                    <button className={`btn ${activeTool === 'eraser' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTool('eraser')} title="Eraser">🧹</button>
                    <button className={`btn ${activeTool === 'text' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTool('text')} title="Text">T</button>
                </div>

                <div className="vr"></div>

                <div className="btn-group" role="group">
                    <button className={`btn ${activeTool === 'rect' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTool('rect')} title="Rectangle">⬜</button>
                    <button className={`btn ${activeTool === 'circle' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTool('circle')} title="Circle">⚪</button>
                    <button className={`btn ${activeTool === 'line' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTool('line')} title="Line">➖</button>
                </div>

                <div className="vr"></div>

                <div className="d-flex align-items-center gap-2">
                    <div className="d-flex flex-column align-items-center">
                        <small style={{ fontSize: '0.7rem' }}>Stroke</small>
                        <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="form-control form-control-color form-control-sm" title="Stroke Color" />
                    </div>
                    <div className="d-flex flex-column align-items-center">
                        <small style={{ fontSize: '0.7rem' }}>Fill</small>
                        <div className="d-flex align-items-center gap-1">
                            <input type="checkbox" checked={fillColor !== 'transparent'} onChange={(e) => setFillColor(e.target.checked ? '#ffffff' : 'transparent')} title="Toggle Fill" />
                            {fillColor !== 'transparent' && (
                                <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="form-control form-control-color form-control-sm" title="Fill Color" />
                            )}
                        </div>
                    </div>
                    <div className="d-flex flex-column align-items-center" style={{ width: '100px' }}>
                        <small style={{ fontSize: '0.7rem' }}>Size: {brushSize}</small>
                        <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="form-range" />
                    </div>
                </div>

                <div className="vr"></div>

                <div className="btn-group">
                    <button className="btn btn-outline-secondary" onClick={undo} disabled={historyIndex <= 0}>↩️</button>
                    <button className="btn btn-outline-secondary" onClick={redo} disabled={historyIndex >= history.length - 1}>↪️</button>
                </div>
                <div className="btn-group">
                    <button className="btn btn-outline-success" onClick={saveImage}>💾 PNG</button>
                    <button className="btn btn-outline-success" onClick={savePDF}>📄 PDF</button>
                </div>
                <button className="btn btn-outline-danger" onClick={clearCanvas}>🗑️ Clear</button>
            </div>

            <div className="whiteboard-container shadow-lg position-relative bg-white" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

export default Whiteboard;








