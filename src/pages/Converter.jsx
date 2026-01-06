import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Save, ZoomIn, ZoomOut, Image as ImageIcon, Box as BoxIcon, Loader2, RotateCw, AlertCircle, Camera, BookOpen, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { listProjects, saveModelFlow, uploadModelToCloud } from '@/lib/data-service';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";

// THREE JS IMPORTS
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js'; // For iOS AR
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import JSZip from 'jszip'; // For ZIP support
import { QRCodeSVG } from 'qrcode.react';

function Converter() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useLanguage();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState("3d");
    const [showLibrary, setShowLibrary] = useState(true); // Default OPEN
    const [disableFog, setDisableFog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [projects, setProjects] = useState([]);
    const [userModels, setUserModels] = useState([]);
    const [uploadStatus, setUploadStatus] = useState("");
    const [saveData, setSaveData] = useState({ name: '', projectId: '' });
    const [largeFileToUpload, setLargeFileToUpload] = useState(null);

    // Refs
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const fileInput3DRef = useRef(null);

    // 3D State
    const [modelFile, setModelFile] = useState(null);
    const [modelObject, setModelObject] = useState(null);
    const [isRxMode, setIsRxMode] = useState(false);
    const [color, setColor] = useState("#ffffff");
    const [rotation, setRotation] = useState(0);
    const [verticalPos, setVerticalPos] = useState(0);

    // Dialogs
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showHelpDialog, setShowHelpDialog] = useState(false);
    const [helpContent, setHelpContent] = useState(null);

    const [libraryError, setLibraryError] = useState(null);

    // Initial Load
    useEffect(() => {
        if (user) loadAllData();
    }, [user]);

    const loadAllData = async () => {
        setLibraryError(null);
        try {
            const projs = await listProjects(user);
            setProjects(projs);

            // Polyfill for models (since data-service might not export it yet)
            const { data: models, error } = await supabase
                .from('models')
                .select('*')
                .eq('user_id', user?.id) // Explicitly filter by user to be safe, though RLS should handle it
                .order('created_at', { ascending: false });

            if (error) throw error;

            setUserModels(models || []);
            console.log("Library loaded:", projs.length, "projects,", models?.length, "models");
        } catch (e) {
            console.error("Error loading data:", e);
            setLibraryError(e.message);
            toast({ title: "Error de carga", description: "No se pudo cargar la librería.", variant: "destructive" });
        }
    };

    // ==================== SAVE LOGIC (NEW) ====================
    const confirmSaveToProject = async () => {
        console.log("Save Button Pressed with Data:", saveData);
        // Immediate UI feedback
        setShowSaveDialog(false);

        if (!user) {
            toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" });
            return;
        }
        if (!saveData.name) {
            toast({ title: "Error", description: "Nombre requerido.", variant: "destructive" });
            // Re-open if invalid
            setShowSaveDialog(true);
            return;
        }

        setLoading(true);
        setUploadStatus("Iniciando...");

        try {
            let fileToUpload = null;

            // SMART BYPASS: Upload Original File if available
            if (modelFile) {
                console.log("Smart Save: Uploading original source.", modelFile.name);
                setUploadStatus("Subiendo archivo original...");

                const ext = modelFile.name.split('.').pop();
                // Sanitize filename
                const safeName = saveData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const fileName = `${safeName}.${ext}`;

                fileToUpload = new File([modelFile], fileName, { type: modelFile.type });

                // UX Pause
                await new Promise(r => setTimeout(r, 300));
            } else {
                // Generated Layout / Empty Scene
                setUploadStatus("Generando escena 3D...");
                await new Promise(r => setTimeout(r, 100));
                const blob = await generateGLB();
                if (!blob) throw new Error("No se pudo generar el archivo 3D.");

                const safeName = saveData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const fileName = `${safeName}.glb`;
                fileToUpload = new File([blob], fileName, { type: 'model/gltf-binary' });
            }

            // Ensure Project ID
            const targetProjectId = saveData.projectId || (projects[0]?.id);
            // If still no project ID, saveModelFlow might create one if we pass 'new'? 
            // Checking data-service capabilities...

            setUploadStatus("Enviando a la nube...");

            await saveModelFlow({
                file: fileToUpload,
                selectedProjectId: targetProjectId,
                authUser: user, // <--- EXPLICITLY PASS THE AUTH USER
                onStep: (info) => {
                    setUploadStatus(info.message);
                    setProgress(Math.round((info.step / info.total) * 100));
                }
            });

            toast({ title: "¡Guardado!", description: "Modelo añadido a tu librería." });
            await loadAllData(); // Refresh list

        } catch (error) {
            console.error("Save Error:", error);
            // alert(`ERROR FINAL: ${error.message}`);
            toast({
                title: "Error al Guardar",
                description: `Fallo: ${error.message}. Revisa la consola si persiste.`,
                variant: "destructive",
                duration: 9000
            });
        } finally {
            setLoading(false);
            setUploadStatus("");
            setProgress(0);
        }
    };

    const handleDirectUpload = async (file) => {
        setLoading(true);
        try {
            // Reuse logic ideally, but large files might skip GLB gen
            // We use uploadModelToCloud directly or saveModelFlow
            // Need a project ID
            let pid = projects[0]?.id;

            await saveModelFlow({
                file,
                selectedProjectId: pid, // Will create new if null
                onStep: (info) => {
                    setUploadStatus(info.message);
                    setProgress((info.step / info.total) * 100);
                }
            });

            toast({ title: "Subida Completa", description: "Archivo guardado correctamente." });
            await loadAllData();
            setLargeFileToUpload(null);

        } catch (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
            setUploadStatus("");
        }
    };

    // ==================== 3D LOGIC (Preserved) ====================
    // ... (Keep existing generateGLB, loadModelFile, etc) ...

    const generateGLB = async () => {
        const parseGLB = (obj) => {
            return new Promise((resolve, reject) => {
                const exporter = new GLTFExporter();
                try {
                    exporter.parse(
                        obj,
                        (gltf) => {
                            const blob = new Blob([gltf], { type: 'application/octet-stream' });
                            resolve(blob);
                        },
                        (error) => reject(error),
                        { binary: true }
                    );
                } catch (err) {
                    reject(err);
                }
            });
        };

        if (!modelObject) throw new Error("No model loaded");
        try {
            return await parseGLB(modelObject);
        } catch (error) {
            console.warn("Standard export failed, attempting geometry-only export...", error);
            const safeObj = modelObject.clone();
            safeObj.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.map = null;
                    child.material.color.setHex(0xaaaaaa);
                }
            });
            return await parseGLB(safeObj);
        }
    };

    // ==================== AR LOGIC ====================
    const [showArDialog, setShowArDialog] = useState(false);
    const [arUrls, setArUrls] = useState({ usdz: null, glb: null });

    const generateUSDZ = async () => {
        return new Promise((resolve, reject) => {
            if (!modelObject) return reject("No model");
            const exporter = new USDZExporter();
            exporter.parse(modelObject, (usdz) => {
                const blob = new Blob([usdz], { type: 'application/octet-stream' });
                resolve(blob);
            }, { quickLookCompatible: true });
        });
    };

    const handleOpenAR = async () => {
        if (!modelObject) return;
        setLoading(true);
        setUploadStatus("Generando AR (iOS/Android)...");
        try {
            // 1. Generate GLB (Android)
            const glbBlob = await generateGLB();
            const glbUrl = URL.createObjectURL(glbBlob);

            // 2. Generate USDZ (iOS)
            const usdzBlob = await generateUSDZ();
            const usdzUrl = URL.createObjectURL(usdzBlob);

            setArUrls({ glb: glbUrl, usdz: usdzUrl });
            setShowArDialog(true);
        } catch (e) {
            console.error(e);
            toast({ title: "Error AR", description: "No se pudo generar los archivos AR.", variant: "destructive" });
        } finally {
            setLoading(false);
            setUploadStatus("");
        }
    };

    const handle3DFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        processFiles(files);
        e.target.value = '';
    };

    const processFiles = async (files) => {
        setLoading(true);
        setUploadStatus("Procesando...");

        try {
            const extracted = [];
            for (const f of files) {
                if (f.name.toLowerCase().endsWith('.zip') || f.name.toLowerCase().endsWith('.rar')) {
                    const zip = new JSZip();
                    const contents = await zip.loadAsync(f);
                    for (const filename of Object.keys(contents.files)) {
                        if (!contents.files[filename].dir) {
                            const blob = await contents.files[filename].async('blob');
                            extracted.push(new File([blob], filename.split('/').pop(), { type: blob.type }));
                        }
                    }
                } else {
                    extracted.push(f);
                }
            }

            const main = extracted.find(f => f.name.match(/\.(gltf|glb|obj|fbx|dae)$/i));
            if (main) {
                loadModelFile(main, extracted);
            } else {
                toast({ title: "Error", description: "No se encontró archivo compatible (.glb, .obj, .fbx, .dae).", variant: "destructive" });
                setLoading(false);
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Error procesando archivo: " + e.message, variant: "destructive" });
            setLoading(false);
        }
    };

    const loadModelFile = (file, allFiles) => {
        setModelFile(file);
        const url = URL.createObjectURL(file);
        const ext = file.name.split('.').pop().toLowerCase();

        const manager = new THREE.LoadingManager();
        manager.addHandler(/\.tga$/i, new TGALoader()); // Enable TGA support

        manager.setURLModifier(url => {
            const name = url.split('/').pop().toLowerCase();
            const match = allFiles.find(f => f.name.toLowerCase() === name);
            return match ? URL.createObjectURL(match) : url;
        });

        const onLoad = (obj) => {
            // alert("DEBUG: Modelo cargado en memoria, renderizando...");
            if (modelObject) sceneRef.current.remove(modelObject);
            const final = obj.scene || obj;
            sceneRef.current.add(final);
            setModelObject(final);
            fitModelToView(final);
            setLoading(false);
            setSaveData(curr => ({ ...curr, name: file.name.split('.')[0] }));
            setShowUploadDialog(false); // Close dialog on success
        };

        const onError = (err) => {
            console.error(err);
            alert(`ERROR DE CARGA THREE.JS: ${err.message || "Fallo desconocido al parsear modelo"}`);
            setLoading(false);
        };

        try {
            if (ext === 'glb' || ext === 'gltf') new GLTFLoader(manager).load(url, onLoad, undefined, onError);
            else if (ext === 'fbx') new FBXLoader(manager).load(url, onLoad, undefined, onError);
            else if (ext === 'obj') new OBJLoader(manager).load(url, onLoad, undefined, onError);
            else if (ext === 'dae') new ColladaLoader(manager).load(url, onLoad, undefined, onError);
            else {
                setLoading(false);
                alert("Formato no soportado por el Load Manager");
            }
        } catch (e) {
            alert(`EXCEPCIÓN AL INICIAR LOADER: ${e.message}`);
            setLoading(false);
        }
    };

    // View Utils
    const fitModelToView = (object) => {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);

        // Reset controls
        if (controlsRef.current) {
            const maxDim = Math.max(size.x, size.y, size.z);
            const dist = maxDim * 2;
            cameraRef.current.position.set(dist, dist, dist);
            controlsRef.current.target.set(0, 0, 0);
            controlsRef.current.update();
        }
    };

    const handleDeleteModel = async (e, id) => {
        e.stopPropagation();
        if (!confirm("Eliminar?")) return;

        // Direct delete
        const { error } = await supabase.from('models').delete().eq('id', id);
        if (!error) {
            setUserModels(prev => prev.filter(m => m.id !== id));
            toast({ title: "Eliminado" });
        }
    };

    const handleLoadModel = (m) => {
        if (!m.file_url) return;
        setLoading(true);
        // Simple load from URL
        const ext = m.file_name?.split('.').pop().toLowerCase() || 'glb';
        const url = m.file_url;

        const manager = new THREE.LoadingManager();
        const onLoad = (obj) => {
            if (modelObject) sceneRef.current.remove(modelObject);
            const final = obj.scene || obj;
            sceneRef.current.add(final);
            setModelObject(final);
            fitModelToView(final);
            setLoading(false);
            setSaveData({ name: m.name, projectId: m.project_id });
        };

        if (ext === 'fbx') new FBXLoader(manager).load(url, onLoad);
        else if (ext === 'obj') new OBJLoader(manager).load(url, onLoad);
        else if (ext === 'dae') new ColladaLoader(manager).load(url, onLoad);
        else new GLTFLoader(manager).load(url, onLoad);
    };

    // ==================== RENDERING ====================
    // Initialize ThreeJS Scene
    useEffect(() => {
        if (activeTab !== '3d' || !mountRef.current) return;

        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x151b23);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
        camera.position.set(5, 5, 5);
        cameraRef.current = camera;

        // Initialize Renderer with Error Handling
        let renderer = null;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance', // Try to get best GPU
                failIfMajorPerformanceCaveat: true   // Fail fast if no hardware accel
            });
            renderer.setSize(w, h);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for perf
            mountRef.current.innerHTML = '';
            mountRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;
        } catch (e) {
            console.error("WebGL Init Failed:", e);
            // Show a friendly error in the mount point
            mountRef.current.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:red;text-align:center;padding:20px;">
                    <h3 style="font-weight:bold;margin-bottom:10px;">Error Gráfico (WebGL)</h3>
                    <p style="font-size:12px;">El navegador no pudo iniciar el motor 3D.</p>
                    <p style="font-size:10px;opacity:0.7;margin-top:5px;">Posible causa: Demasiadas pestañas con 3D abiertas.</p>
                    <button onclick="window.location.reload()" style="margin-top:15px;padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;">Recargar Página</button>
                </div>
            `;
            return;
        }

        const controls = new OrbitControls(camera, renderer.domElement);
        controlsRef.current = controls;

        // Lights
        scene.add(new THREE.AmbientLight(0xffffff, 1));
        const dir = new THREE.DirectionalLight(0xffffff, 2);
        dir.position.set(5, 10, 5);
        scene.add(dir);
        scene.add(new THREE.GridHelper(20, 20));

        // Animation Loop
        let animationId;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // CLEANUP
        return () => {
            if (animationId) cancelAnimationFrame(animationId);

            if (renderer) {
                // AGGRESSIVE CLEANUP
                renderer.dispose();
                renderer.forceContextLoss();
                renderer.domElement = null;
                renderer = null;
            }

            if (mountRef.current) mountRef.current.innerHTML = '';

            // Dispose scene objects
            scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        };
    }, [activeTab]);

    // ==================== TRANSFORM LOGIC (RESTORED) ====================
    useEffect(() => {
        if (!modelObject) return;

        // Apply Rotation
        modelObject.rotation.y = rotation;

        // Apply Position (Height)
        modelObject.position.y = verticalPos;

        // Apply Color (Traverse)
        if (isRxMode && color) {
            modelObject.traverse((child) => {
                if (child.isMesh) {
                    // Clone material to avoid affecting shared resources
                    if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material.clone();

                    const newMat = child.userData.originalMaterial.clone();
                    newMat.color.set(color);
                    child.material = newMat;
                }
            });
        }
    }, [rotation, verticalPos, color, modelObject, isRxMode]);

    const resetCamera = () => {
        if (controlsRef.current) controlsRef.current.reset();
        setRotation(0);
        setVerticalPos(0);
        setColor("#ffffff");
    };

    return (
        <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col h-screen overflow-hidden">

            const [showDebugDialog, setShowDebugDialog] = useState(false);

            return (
            <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col h-screen overflow-hidden">

                {/* Header */}
                <header className="border-b border-[#29B6F6]/20 bg-[#151B23] p-4 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="flex flex-col">
                                <h1 className="text-xl font-bold flex items-center gap-2">
                                    <span className="hidden sm:inline">Toolkit & Convertidor</span>
                                    <span className="sm:hidden">Toolkit</span>
                                    <span className="bg-blue-900/50 text-blue-200 text-[10px] px-2 py-0.5 rounded border border-blue-500/30 font-mono">
                                        v3.15 (MOBILE-UI)
                                    </span>
                                </h1>
                            </div>

                            {/* INDICATORS (Mobile Optimized) */}
                            <div
                                className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                                onClick={() => setShowDebugDialog(true)}
                                title="Estado del Sistema"
                            >
                                <div className={`w-2 h-2 rounded-full ${user ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 animate-pulse"}`}></div>
                                <span className="text-xs font-mono text-gray-300 hidden sm:inline">
                                    {user ? "ONLINE" : "OFFLINE"}
                                </span>
                            </div>

                            <div className="hidden sm:block w-px h-4 bg-white/20" />

                            <span className="text-xs text-blue-400 hidden sm:inline">
                                {loading ? (uploadStatus || "Procesando...") : "Listo"}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Mobile Actions Menu could go here, for now buttons wrap or scroll */}
                            <Button variant="ghost" size="sm" onClick={() => setShowLibrary(!showLibrary)} className={showLibrary ? "bg-white/10" : ""}>
                                <BookOpen className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Librería</span>
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setShowDebugDialog(true)}>
                                <AlertCircle className="h-5 w-5 text-gray-400" />
                            </Button>
                        </div>
                    </div>

                    {/* Secondary Toolbar - Scrollable on mobile */}
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar sm:justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)} className="whitespace-nowrap">
                            <Upload className="h-4 w-4 mr-2" /> Subir
                        </Button>
                        <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white border border-purple-400/30 whitespace-nowrap"
                            onClick={handleOpenAR}
                            disabled={!modelObject}
                        >
                            <BoxIcon className="h-4 w-4 mr-2" /> AR / Proyectar
                        </Button>
                        <Button size="sm" onClick={() => setShowSaveDialog(true)} disabled={!modelObject} className="whitespace-nowrap">
                            <Save className="h-4 w-4 mr-2" /> Guardar
                        </Button>
                    </div>

                </header >

                <div className="flex-1 flex overflow-hidden">

                    {/* 3D View */}
                    <div
                        className="flex-1 relative bg-black/50"
                        style={{ touchAction: 'none' }} // PREVENTS SCROLL ON MOBILE DRAG
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const files = Array.from(e.dataTransfer.files);
                            if (files.length > 0) processFiles(files);
                        }}
                    >
                        {/* Three.js Container */}
                        <div ref={mountRef} className="absolute inset-0 overflow-hidden" />

                        {/* React Overlay - Empty State */}
                        {!modelObject && (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none p-4 text-center">
                                <p>Arrastra un archivo aquí o usa "Subir ZIP"</p>
                            </div>
                        )}

                        {/* CONTROL BAR (MOBILE OPTIMIZED) */}
                        {modelObject && (
                            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-[#151B23]/90 border border-white/10 p-3 rounded-lg backdrop-blur-md flex items-center gap-4 shadow-xl z-10 w-[95%] max-w-2xl justify-around overflow-x-auto no-scrollbar">

                                {/* Rotation */}
                                <div className="flex flex-col items-center gap-1 min-w-[80px] w-full max-w-[120px]">
                                    <span className="text-[9px] text-gray-400 font-mono uppercase">Rotación</span>
                                    <Slider
                                        value={[rotation]}
                                        min={0} max={6.28} step={0.1}
                                        onValueChange={([v]) => setRotation(v)}
                                        className="w-full"
                                    />
                                </div>

                                {/* Height */}
                                <div className="flex flex-col items-center gap-1 min-w-[80px] w-full max-w-[120px]">
                                    <span className="text-[9px] text-gray-400 font-mono uppercase">Altura</span>
                                    <Slider
                                        value={[verticalPos]}
                                        min={-5} max={5} step={0.1}
                                        onValueChange={([v]) => setVerticalPos(v)}
                                        className="w-full"
                                    />
                                </div>

                                {/* Color Toggle */}
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-gray-400 font-mono uppercase">Pintura</span>
                                        <Switch checked={isRxMode} onCheckedChange={setIsRxMode} />
                                    </div>
                                    {isRxMode && (
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) => setColor(e.target.value)}
                                            className="w-8 h-6 bg-transparent cursor-pointer"
                                        />
                                    )}
                                </div>

                                {/* Reset */}
                                <Button variant="ghost" size="icon" onClick={resetCamera} title="Reset Camera" className="shrink-0">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Library Sidebar (Responsive) */}
                    {showLibrary && (
                        <div className="w-80 border-l border-white/10 bg-[#151B23] p-4 overflow-y-auto flex flex-col absolute inset-y-0 right-0 z-20 sm:static sm:z-0 shadow-2xl sm:shadow-none transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold">Tu Librería</h3>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={loadAllData} disabled={loading}>
                                        <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    </Button>
                                    {/* Mobile Close Button */}
                                    <Button variant="ghost" size="sm" className="sm:hidden" onClick={() => setShowLibrary(false)}>
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Error Message */}
                            {libraryError && (
                                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded mb-4 text-xs text-red-200">
                                    ⚠️ {libraryError}
                                </div>
                            )}

                            {/* Projects / Models List */}
                            <div className="space-y-4 flex-1">
                                {userModels.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <BoxIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No tienes modelos guardados.</p>
                                        <p className="text-xs mt-1">Sube uno para empezar.</p>
                                    </div>
                                ) : (
                                    userModels.map(m => (
                                        <div key={m.id} className="p-3 bg-white/5 rounded hover:bg-white/10 cursor-pointer group" onClick={() => { handleLoadModel(m); if (window.innerWidth < 640) setShowLibrary(false); }}>
                                            <div className="flex justify-between">
                                                <p className="font-medium truncate max-w-[150px]" title={m.name || m.file_name}>
                                                    {m.name || m.file_name}
                                                </p>
                                                <Trash2 className="h-4 w-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteModel(e, m.id); }} />
                                            </div>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                        </div>
                            <DialogFooter>
                                <Button onClick={confirmSaveToProject}>Guardar</Button>
                            </DialogFooter>
                        </DialogContent>
                </Dialog>

                {/* AR DIALOG */}
                <Dialog open={showArDialog} onOpenChange={setShowArDialog}>
                    <DialogContent className="sm:max-w-md bg-[#151B23] border border-gray-700 text-white">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <BoxIcon className="text-purple-400" /> Visualizador AR
                            </DialogTitle>
                            <DialogDescription className="text-gray-400">
                                Escanea el código con tu celular o usa los botones si ya estás en móvil.
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="ios" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-black/40">
                                <TabsTrigger value="ios">iOS (iPhone/iPad)</TabsTrigger>
                                <TabsTrigger value="android">Android</TabsTrigger>
                            </TabsList>

                            {/* iOS TAB */}
                            <TabsContent value="ios" className="flex flex-col items-center gap-4 py-4">
                                <div className="bg-white p-2 rounded-lg">
                                    {/* NOTE: In production, URL.createObjectURL won't work cross-device via QR. 
                                    Ideally we upload to cloud and share URL. 
                                    For now, we use Blob URL (works if user is on SAME device). 
                                    To fix cross-device, we'd need to upload first. 
                                    Let's warn user or auto-upload? 
                                    Actually, standard practice for local generator is just download.
                                */}
                                    <QRCodeSVG value={arUrls.usdz || ""} size={150} />
                                </div>
                                <p className="text-xs text-center text-gray-400 px-4">
                                    * Nota: El QR solo funciona si ambos dispositivos comparten la sesión (Blob local).
                                    Para compartir real, usa "Subir a Librería" primero.
                                </p>
                                <a
                                    href={arUrls.usdz}
                                    rel="ar"
                                    download="model.usdz"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded font-bold flex items-center justify-center gap-2"
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/ca/IOS_logo_2013.svg" className="w-4 h-4 invert" alt="iOS" />
                                    Abrir en AR Quick Look
                                </a>
                            </TabsContent>

                            {/* ANDROID TAB */}
                            <TabsContent value="android" className="flex flex-col items-center gap-4 py-4">
                                <div className="bg-white p-2 rounded-lg">
                                    <QRCodeSVG value={arUrls.glb || ""} size={150} />
                                </div>
                                <a
                                    href={`intent://view?file=${encodeURIComponent(arUrls.glb)}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${encodeURIComponent(window.location.href)};end;`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full bg-green-600 hover:bg-green-700 text-white text-center py-2 rounded font-bold flex items-center justify-center gap-2"
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/d/d7/Android_robot.svg" className="w-4 h-4" alt="Android" />
                                    Abrir en Scene Viewer
                                </a>
                            </TabsContent>
                        </Tabs>
                    </DialogContent>
                </Dialog>

                <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Subir Archivos</DialogTitle></DialogHeader>
                        <div className="grid place-items-center p-8 border-2 border-dashed rounded cursor-pointer hover:bg-white/5" onClick={() => fileInput3DRef.current?.click()}>
                            <Upload className="h-8 w-8 mb-2" />
                            <p onClick={(e) => { e.stopPropagation(); fileInput3DRef.current?.click(); }}>Clic para seleccionar archivos (Forzar)</p>
                        </div>
                    </DialogContent>
                </Dialog>
            </div >
            );
}

            export default Converter;
