import React, { useEffect, useRef, useState } from 'react';
import { Canvas, util, PencilBrush, Rect, Circle, Line, IText, FabricObject } from 'fabric';
import { socket } from '../services/socket';
import jsPDF from 'jspdf';

type Tool = 'select' | 'pencil' | 'rect' | 'circle' | 'line' | 'text' | 'eraser';

const Whiteboard: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
    const [tool, setTool] = useState<Tool>('pencil');
    const [stroke, setStroke] = useState('#000000');
    const [fill, setFill] = useState('transparent');
    const [width, setWidth] = useState(5);

    const toolRef = useRef<Tool>('pencil');
    const strokeRef = useRef('#000000');
    const fillRef = useRef('transparent');
    const widthRef = useRef(5);
    const undoing = useRef(false);

    const drawing = useRef(false);
    const start = useRef<{ x: number, y: number } | null>(null);
    const currentShape = useRef<FabricObject | null>(null);

    const [stack, setStack] = useState<string[]>([]);
    const [ptr, setPtr] = useState(-1);

    useEffect(() => {
        toolRef.current = tool;
        strokeRef.current = stroke;
        fillRef.current = fill;
        widthRef.current = width;

        if (fabricCanvas) {
            fabricCanvas.isDrawingMode = tool === 'pencil';
            fabricCanvas.selection = tool === 'select';
            fabricCanvas.defaultCursor = tool === 'text' ? 'text' : 'default';

            if (fabricCanvas.freeDrawingBrush) {
                fabricCanvas.freeDrawingBrush.color = stroke;
                fabricCanvas.freeDrawingBrush.width = width;
            }

            fabricCanvas.getObjects().forEach((obj) => {
                obj.selectable = tool === 'select' || tool === 'eraser';
                obj.evented = tool === 'select' || tool === 'eraser';
            });
            fabricCanvas.requestRenderAll();
        }
    }, [tool, stroke, fill, width, fabricCanvas]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const cvs = new Canvas(canvasRef.current, {
            width: 800,
            height: 600,
            backgroundColor: 'white',
            selection: false,
        });

        setFabricCanvas(cvs);
        socket.emit('join-room', 'default-room');

        const brush = new PencilBrush(cvs);
        brush.color = strokeRef.current;
        brush.width = widthRef.current;
        cvs.freeDrawingBrush = brush;

        const init = JSON.stringify(cvs);
        setStack([init]);
        setPtr(0);

        cvs.on('path:created', (e: any) => {
            if (toolRef.current === 'pencil') {
                syncObject(e.path, cvs);
            }
        });

        cvs.on('object:modified', () => {
            pushState(cvs);
        });

        cvs.on('mouse:down', (o: any) => onMouseDown(o, cvs));
        cvs.on('mouse:move', (o: any) => onMouseMove(o, cvs));
        cvs.on('mouse:up', (o: any) => onMouseUp(o, cvs));

        socket.on('draw', (data: any) => {
            util.enlivenObjects([data.object]).then((objects: any[]) => {
                objects.forEach((o) => {
                    cvs.add(o);
                });
                cvs.renderAll();
                pushState(cvs);
            });
        });

        socket.on('clear', () => {
            cvs.clear();
            cvs.backgroundColor = 'white';
            cvs.renderAll();
            pushState(cvs);
        });

        return () => {
            cvs.dispose();
            socket.off('draw');
            socket.off('clear');
        };
    }, []);

    const onMouseDown = (o: any, cvs: Canvas) => {
        const p = cvs.getPointer(o.e);
        start.current = { x: p.x, y: p.y };
        const t = toolRef.current;

        if (t === 'select') return;

        if (t === 'eraser') {
            if (o.target) {
                cvs.remove(o.target);
                pushState(cvs);
            }
            return;
        }

        if (t === 'text') {
            const txt = new IText('Type here', {
                left: p.x,
                top: p.y,
                fill: strokeRef.current,
                fontSize: widthRef.current * 4,
            });
            cvs.add(txt);
            cvs.setActiveObject(txt);
            txt.enterEditing();
            syncObject(txt, cvs);
            setTool('select');
            return;
        }

        if (['rect', 'circle', 'line'].includes(t)) {
            drawing.current = true;
            let s: FabricObject | null = null;
            const st = strokeRef.current;
            const fl = fillRef.current === 'transparent' ? '' : fillRef.current;
            const w = widthRef.current;

            if (t === 'rect') {
                s = new Rect({
                    left: p.x,
                    top: p.y,
                    width: 0,
                    height: 0,
                    fill: fl,
                    stroke: st,
                    strokeWidth: w,
                    transparentCorners: false
                });
            } else if (t === 'circle') {
                s = new Circle({
                    left: p.x,
                    top: p.y,
                    radius: 0,
                    fill: fl,
                    stroke: st,
                    strokeWidth: w,
                    originX: 'center',
                    originY: 'center'
                });
            } else if (t === 'line') {
                s = new Line([p.x, p.y, p.x, p.y], {
                    stroke: st,
                    strokeWidth: w,
                });
            }

            if (s) {
                currentShape.current = s;
                cvs.add(s);
            }
        }
    };

    const onMouseMove = (o: any, cvs: Canvas) => {
        if (!drawing.current || !currentShape.current || !start.current) return;
        const p = cvs.getPointer(o.e);
        const t = toolRef.current;

        if (t === 'rect') {
            const r = currentShape.current as Rect;
            r.set({
                width: Math.abs(p.x - start.current.x),
                height: Math.abs(p.y - start.current.y),
                left: Math.min(p.x, start.current.x),
                top: Math.min(p.y, start.current.y)
            });
        } else if (t === 'circle') {
            const c = currentShape.current as Circle;
            const rad = Math.sqrt(Math.pow(p.x - start.current.x, 2) + Math.pow(p.y - start.current.y, 2)) / 2;
            c.set({ radius: rad });
        } else if (t === 'line') {
            const l = currentShape.current as Line;
            l.set({ x2: p.x, y2: p.y });
        }

        cvs.renderAll();
    };

    const onMouseUp = (o: any, cvs: Canvas) => {
        if (drawing.current && currentShape.current) {
            syncObject(currentShape.current, cvs);
            currentShape.current = null;
            drawing.current = false;
        }
    };

    const syncObject = (obj: FabricObject, cvs: Canvas) => {
        socket.emit('draw', {
            roomId: 'default-room',
            object: obj.toObject(),
        });
        pushState(cvs);
    };

    const pushState = (c: Canvas) => {
        if (undoing.current) return;
        const json = JSON.stringify(c);
        setStack((prev) => {
            const next = prev.slice(0, ptr + 1);
            next.push(json);
            return next;
        });
        setPtr((prev) => prev + 1);
    };

    const undo = () => {
        if (ptr > 0 && fabricCanvas) {
            undoing.current = true;
            const nextPtr = ptr - 1;
            setPtr(nextPtr);
            fabricCanvas.loadFromJSON(stack[nextPtr]).then(() => {
                fabricCanvas.renderAll();
                undoing.current = false;

                fabricCanvas.isDrawingMode = toolRef.current === 'pencil';
                fabricCanvas.selection = toolRef.current === 'select';

                if (fabricCanvas.freeDrawingBrush) {
                    fabricCanvas.freeDrawingBrush.color = strokeRef.current;
                    fabricCanvas.freeDrawingBrush.width = widthRef.current;
                }
            });
        }
    };

    const redo = () => {
        if (ptr < stack.length - 1 && fabricCanvas) {
            undoing.current = true;
            const nextPtr = ptr + 1;
            setPtr(nextPtr);
            fabricCanvas.loadFromJSON(stack[nextPtr]).then(() => {
                fabricCanvas.renderAll();
                undoing.current = false;

                fabricCanvas.isDrawingMode = toolRef.current === 'pencil';
                fabricCanvas.selection = toolRef.current === 'select';

                if (fabricCanvas.freeDrawingBrush) {
                    fabricCanvas.freeDrawingBrush.color = strokeRef.current;
                    fabricCanvas.freeDrawingBrush.width = widthRef.current;
                }
            });
        }
    };

    const exportImg = () => {
        if (!fabricCanvas) return;
        const url = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 });
        const a = document.createElement('a');
        a.href = url;
        a.download = 'whiteboard.png';
        a.click();
    };

    const exportPdf = () => {
        if (!fabricCanvas) return;
        const data = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 });
        const pdf = new jsPDF();
        pdf.addImage(data, 'PNG', 0, 0, 210, 150);
        pdf.save('whiteboard.pdf');
    };

    const wipe = () => {
        socket.emit('clear', 'default-room');
    };

    return (
        <div className="d-flex flex-column align-items-center position-relative w-100 h-100">
            <div className="glass-panel p-3 mb-3 d-flex gap-3 align-items-center flex-wrap justify-content-center shadow-sm" style={{ borderRadius: '15px', zIndex: 10 }}>

                <div className="btn-group" role="group">
                    <button className={`btn ${tool === 'select' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTool('select')} title="Select">Select</button>
                    <button className={`btn ${tool === 'pencil' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTool('pencil')} title="Pencil">✏️</button>
                    <button className={`btn ${tool === 'eraser' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTool('eraser')} title="Eraser">🧹</button>
                    <button className={`btn ${tool === 'text' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTool('text')} title="Text">T</button>
                </div>

                <div className="vr"></div>

                <div className="btn-group" role="group">
                    <button className={`btn ${tool === 'rect' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTool('rect')} title="Rectangle">⬜</button>
                    <button className={`btn ${tool === 'circle' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTool('circle')} title="Circle">⚪</button>
                    <button className={`btn ${tool === 'line' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTool('line')} title="Line">➖</button>
                </div>

                <div className="vr"></div>

                <div className="d-flex align-items-center gap-2">
                    <div className="d-flex flex-column align-items-center">
                        <small style={{ fontSize: '0.7rem' }}>Stroke</small>
                        <input type="color" value={stroke} onChange={(e) => setStroke(e.target.value)} className="form-control form-control-color form-control-sm" title="Stroke Color" />
                    </div>
                    <div className="d-flex flex-column align-items-center">
                        <small style={{ fontSize: '0.7rem' }}>Fill</small>
                        <div className="d-flex align-items-center gap-1">
                            <input type="checkbox" checked={fill !== 'transparent'} onChange={(e) => setFill(e.target.checked ? '#ffffff' : 'transparent')} title="Toggle Fill" />
                            {fill !== 'transparent' && (
                                <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} className="form-control form-control-color form-control-sm" title="Fill Color" />
                            )}
                        </div>
                    </div>
                    <div className="d-flex flex-column align-items-center" style={{ width: '100px' }}>
                        <small style={{ fontSize: '0.7rem' }}>Size: {width}</small>
                        <input type="range" min="1" max="50" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} className="form-range" />
                    </div>
                </div>

                <div className="vr"></div>

                <div className="btn-group">
                    <button className="btn btn-outline-secondary" onClick={undo} disabled={ptr <= 0}>↩️</button>
                    <button className="btn btn-outline-secondary" onClick={redo} disabled={ptr >= stack.length - 1}>↪️</button>
                </div>
                <div className="btn-group">
                    <button className="btn btn-outline-success" onClick={exportImg}>💾 PNG</button>
                    <button className="btn btn-outline-success" onClick={exportPdf}>📄 PDF</button>
                </div>
                <button className="btn btn-outline-danger" onClick={wipe}>🗑️ Clear</button>
            </div>

            <div className="whiteboard-container shadow-lg position-relative bg-white" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                <canvas ref={canvasRef} />
            </div>
        </div>
    );
};

export default Whiteboard;








