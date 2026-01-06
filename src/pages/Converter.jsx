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

function Converter() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useLanguage();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState("3d");
    const [showLibrary, setShowLibrary] = useState(false);
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

            {/* DEBUG CONSOLE (Fixed Visibility) */}
            <div className="fixed top-24 right-4 z-[99999] bg-zinc-950 border-2 border-red-500 p-4 rounded-lg shadow-2xl text-xs font-mono text-white w-72 backdrop-blur-sm">
                <h3 className="font-bold border-b border-red-500/30 pb-1 mb-2 text-red-400 flex justify-between items-center">
                    <span>DEBUGGER v3.13</span>
                    <span className={user ? "text-green-400" : "text-red-500"}>●</span>
                </h3>

                <div className="bg-[#151B23] px-3 py-1.5 rounded border border-[#1E293B]">
                    <span className="text-[#29B6F6] text-xs font-bold">v3.13</span>
                    <span className="text-gray-500 text-[10px] ml-2 font-mono">(SECURE-AUTH)</span>
                </div>
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span className={user ? "text-green-400" : "text-red-400"}>{loading ? "LOADING" : user ? "ONLINE" : "OFFLINE"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">User ID:</span>
                        <span className="text-blue-300">{user?.id?.substring(0, 8) || 'NULL'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Hash:</span>
                        <span className="text-amber-300 break-all">{window.location.hash.substring(0, 10) || 'EMPTY'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-500">Params:</span>
                        <span className="text-amber-300">{window.location.search || 'EMPTY'}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: { redirectTo: window.location.origin + window.location.pathname }
                        })}
                        className="bg-red-900/50 hover:bg-red-700 border border-red-700 text-red-100 p-2 rounded transition-colors"
                    >
                        LOGIN
                    </button>
                    <button
                        onClick={() => {
                            const info = `
                            URL: ${window.location.href}
                            LS-Token: ${localStorage.getItem('sb-uufffrsgpdcocosfukjm-auth-token') ? 'FOUND' : 'MISSING'}
                            Session: ${JSON.stringify(user || 'null')}
                            `;
                            alert(info);
                        }}
                        className="bg-blue-900/50 hover:bg-blue-700 border border-blue-700 text-blue-100 p-2 rounded transition-colors"
                    >
                        INSPECT
                    </button>
                </div>
            </div>

            {/* Header */}
            <header className="border-b border-[#29B6F6]/20 bg-[#151B23] p-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                Toolkit & Convertidor
                                <span className="bg-blue-900/50 text-blue-200 text-[10px] px-2 py-0.5 rounded border border-blue-500/30 font-mono">
                                    v3.13 (AUTH-BOOT)
                                </span>
                            </h1>
                        </div>

                        {/* INDICATORS (New) */}
                        <div
                            className="flex items-center gap-3 px-4 py-1 bg-black/30 rounded-full border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                            onClick={() => {
                                if (!user) {
                                    // FORCE REDIRECT TO CURRENT PAGE (Avoids /dashboard logic mismatch)
                                    supabase.auth.signInWithOAuth({
                                        provider: 'google',
                                        options: { redirectTo: window.location.origin + window.location.pathname }
                                    });
                                } else {
                                    // Debug: Log session
                                    console.log("Current Session:", user);
                                    alert(`Session Info:\nID: ${user.id}\nEmail: ${user.email}`);
                                }
                            }}
                            title={user ? `User: ${user.id} (Click for Details)` : "OFFLINE: Click to Connect"}
                        >
                            {/* Auth LED */}
                            <div className="flex justify-between items-center mb-3 border-b border-red-900/30 pb-2">
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">DEBUGGER v3.13</span>
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                            </div>
                            <span className="text-xs font-mono text-gray-400">
                                {user ? "ONLINE" : "OFFLINE (LOGIN)"}
                            </span>
                        </div>
                        <div className="w-px h-4 bg-white/20" />
                        {/* Status Text */}
                        <span className="text-xs text-blue-400">
                            {loading ? (uploadStatus || "Procesando...") : "Listo para trabajar"}
                        </span>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => setShowLibrary(!showLibrary)}>
                        <BookOpen className="h-4 w-4 mr-2" /> Librería
                    </Button>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                        <Upload className="h-4 w-4 mr-2" /> Subir ZIP/Pack
                    </Button>
                    <Button onClick={() => setShowSaveDialog(true)} disabled={!modelObject}>
                        <Save className="h-4 w-4 mr-2" /> Guardar en Proyecto
                    </Button>
                    <Button variant="secondary" onClick={confirmSaveToProject} disabled={!modelObject}>
                        <Save className="h-4 w-4 mr-2" /> Autosave Test
                    </Button>
                </div>

            </header >

            <div className="flex-1 flex overflow-hidden">

                {/* 3D View */}
                <div
                    className="flex-1 relative bg-black/50"
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
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 pointer-events-none">
                            <p>Arrastra un archivo aquí o usa "Subir ZIP"</p>
                        </div>
                    )}

                    {/* CONTROL BAR (RESTORED) */}
                    {modelObject && (
                        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-[#151B23]/90 border border-white/10 p-3 rounded-lg backdrop-blur-md flex items-center gap-6 shadow-xl z-10 w-[90%] max-w-2xl justify-around">

                            {/* Rotation */}
                            <div className="flex flex-col items-center gap-1 w-32">
                                <span className="text-[10px] text-gray-400 font-mono uppercase">Rotación</span>
                                <Slider
                                    value={[rotation]}
                                    min={0} max={6.28} step={0.1}
                                    onValueChange={([v]) => setRotation(v)}
                                    className="w-full"
                                />
                            </div>

                            {/* Height */}
                            <div className="flex flex-col items-center gap-1 w-32">
                                <span className="text-[10px] text-gray-400 font-mono uppercase">Altura</span>
                                <Slider
                                    value={[verticalPos]}
                                    min={-5} max={5} step={0.1}
                                    onValueChange={([v]) => setVerticalPos(v)}
                                    className="w-full"
                                />
                            </div>

                            {/* Color Toggle */}
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400 font-mono uppercase">Pintura</span>
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
                            <Button variant="ghost" size="icon" onClick={resetCamera} title="Reset Camera">
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Library Sidebar */}
                {showLibrary && (
                    <div className="w-80 border-l border-white/10 bg-[#151B23] p-4 overflow-y-auto flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Tu Librería</h3>
                            <Button variant="ghost" size="sm" onClick={loadAllData} disabled={loading}>
                                <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
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
                                    <div key={m.id} className="p-3 bg-white/5 rounded hover:bg-white/10 cursor-pointer group" onClick={() => handleLoadModel(m)}>
                                        <div className="flex justify-between">
                                            <p className="font-medium truncate" title={m.name || m.file_name}>
                                                {m.name || m.file_name}
                                            </p>
                                            <Trash2 className="h-4 w-4 text-red-500 opacity-0 group-hover:opacity-100"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteModel(e, m.id); }} />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 flex justify-between">
                                            <span>{(m.size / 1024 / 1024).toFixed(1)} MB</span>
                                            <span className="text-gray-600">{new Date(m.created_at).toLocaleDateString()}</span>
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Overlays - Force FIXED to cover confirmed dialogs and everything */}
            {
                loading && (
                    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[9999]">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
                        <p className="text-xl font-bold text-white">{uploadStatus || "Cargando..."}</p>
                        {progress > 0 && <p className="text-lg text-blue-400 mt-2">{progress}%</p>}
                    </div>
                )
            }
            {/* Inputs and Dialogs */}
            <input
                type="file"
                ref={fileInput3DRef}
                className="hidden"
                multiple
                accept=".glb,.gltf,.obj,.fbx,.zip"
                onChange={handle3DFileChange}
            />

            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Guardar Modelo</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <input
                            className="w-full p-2 bg-black/20 border rounded"
                            placeholder="Nombre del modelo"
                            value={saveData.name}
                            onChange={e => setSaveData(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <select
                            className="w-full p-2 bg-black/20 border rounded"
                            value={saveData.projectId}
                            onChange={e => setSaveData(prev => ({ ...prev, projectId: e.target.value }))}
                        >
                            <option value="">-- Nuevo Proyecto --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <DialogFooter>
                        <Button onClick={confirmSaveToProject}>Guardar</Button>
                    </DialogFooter>
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
