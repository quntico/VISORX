
import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Save, ZoomIn, ZoomOut, Image as ImageIcon, Box as BoxIcon, Loader2, RotateCw, AlertCircle, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'; // Added for saved files
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { projectsService, modelsService, storageService } from '@/lib/data-service';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';


function Converter() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useLanguage();
    const { user } = useAuth();

    // UI STATES
    const [activeTab, setActiveTab] = useState("image");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0); // Progress 0-100
    const [projects, setProjects] = useState([]);
    const [userModels, setUserModels] = useState([]); // List of saved models
    const [uploadStatus, setUploadStatus] = useState(""); // Specific status message for loading overlay

    // DIALOG STATES
    const [showHelpDialog, setShowHelpDialog] = useState(false);
    const [helpContent, setHelpContent] = useState(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveData, setSaveData] = useState({ name: '', projectId: '' });
    const [largeFileToUpload, setLargeFileToUpload] = useState(null); // New state for large file confirmation

    // LOAD PROJECTS & MODELS
    useEffect(() => {
        if (user) {
            loadAllData();
        }
    }, [user]);

    const loadAllData = async () => {
        try {
            const projs = await projectsService.getAll();
            setProjects(projs);

            // Fetch models from all projects to build "My Library"
            let allModels = [];
            for (const p of projs) {
                const pModels = await modelsService.getByProject(p.id);
                if (pModels) allModels = [...allModels, ...pModels];
            }
            // Sort by newest
            allModels.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setUserModels(allModels);
        } catch (e) {
            console.error("Error loading library:", e);
            toast({ title: t('common.error'), description: "No se pudieron cargar los modelos guardados.", variant: "destructive" });
        }
    };

    // AR HANDLER
    const [showAR, setShowAR] = useState(false);
    const [arBlobUrl, setArBlobUrl] = useState(null);

    const handleOpenAR = async () => {
        if (!modelObject) return;
        setLoading(true);
        try {
            const blob = await generateGLB();
            const url = URL.createObjectURL(blob);
            setArBlobUrl(url);
            setShowAR(true);
        } catch (error) {
            console.error("AR Error:", error);
            toast({ title: "Error AR", description: "No se pudo preparar el modelo para AR.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // PRE-DEFINED GUIDES
    const guides = {
        twinmotion: {
            title: "Archivo de Twinmotion Detectado",
            description: (
                <div className="space-y-4 text-sm">
                    <p>
                        Los archivos <strong>.tm</strong> y <strong>.udatasmith</strong> son formatos cerrados que no funcionan directamente en la web.
                    </p>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded text-yellow-200">
                        <strong>Solución:</strong> Necesitas exportar tu modelo a un formato estándar de intercambio (FBX o OBJ).
                    </div>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>Si tienes el modelo original en <strong>SketchUp</strong> o <strong>Revit</strong>, expórtalo directamente desde ahí como <strong>.FBX</strong>.</li>
                        <li>Si solo tienes el archivo en Twinmotion, debes instalar el plugin <strong>Datasmith Exporter</strong> o exportar a Unreal Engine primero.</li>
                        <li>Recomendamos encarecidamente usar el archivo fuente original (SketchUp/Revit/Rhino) para la conversión web.</li>
                    </ol>
                </div>
            )
        },
        general: {
            title: "Guía de Exportación y Texturas",
            description: (
                <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded mb-4">
                        <p className="text-blue-200 text-xs">
                            <strong>¡Importante!</strong> Para que se vean los colores/materiales, debes subir el modelo <strong>Y</strong> las texturas al mismo tiempo, o usar un formato que las incluya (GLB o FBX incrustado).
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-bold text-[#29B6F6] text-sm">Desde SketchUp</h4>
                        <ol className="list-decimal list-inside text-gray-300 text-xs space-y-1">
                            <li>Ve a <strong>Archivo &gt; Exportar &gt; Modelo 3D</strong>.</li>
                            <li>Selecciona el tipo <strong>FBX (*.fbx)</strong>.</li>
                            <li>Haz clic en el botón <strong>Opciones</strong>.</li>
                            <li>Asegúrate de marcar: <strong>"Exportar mapas de textura"</strong> (Export Texture Maps).</li>
                            <li>Exporta y sube ese archivo aquí.</li>
                        </ol>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-bold text-[#29B6F6] text-sm">Desde Twinmotion / Unreal</h4>
                        <ul className="list-disc list-inside text-gray-300 text-xs space-y-1">
                            <li>Twinmotion no exporta directamente para web.</li>
                            <li>Opción 1: Exporta a <strong>Unreal Engine</strong> y de ahí a <strong>GLB</strong>.</li>
                            <li>Opción 2: Si tienes el modelo original (Revit/Sketchup), úsalo en su lugar.</li>
                        </ul>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                        <h4 className="font-bold text-white text-xs mb-2">Formatos Recomendados</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white/5 p-2 rounded">
                                <span className="text-green-400 font-bold">.FBX</span>
                                <p className="text-gray-500">Universal. Mejor si tiene opción "Embed Media".</p>
                            </div>
                            <div className="bg-white/5 p-2 rounded">
                                <span className="text-green-400 font-bold">.OBJ</span>
                                <p className="text-gray-500">Simple. Requiere subir el .MTL y las imágenes texturales junto con él.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }
    };

    const openGuide = (type = 'general') => {
        setHelpContent(guides[type]);
        setShowHelpDialog(true);
    };

    // --- IMAGE STATE ---
    const [image, setImage] = useState(null);
    const [imgScale, setImgScale] = useState(1);
    const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
    const [imgTargetDims, setImgTargetDims] = useState({ width: 1024, height: 1024 });
    const canvasRef = useRef(null);
    const imgContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // --- 3D STATE ---
    const [modelFile, setModelFile] = useState(null);
    const [modelObject, setModelObject] = useState(null);
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null); // Added ref for controls
    const fileInput3DRef = useRef(null);
    const progressStartTime = useRef(0); // Track start time for estimation

    // ==================== IMAGE LOGIC ====================
    const handleImageFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast({ title: t('common.error'), description: "Formato no válido. Sube una imagen PNG o JPG.", variant: "destructive" });
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    setImgScale(1);
                    setImgPos({ x: 0, y: 0 });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const drawImage = () => {
        if (!canvasRef.current || !image) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.save();
        ctx.translate(centerX + imgPos.x, centerY + imgPos.y);
        ctx.scale(imgScale, imgScale);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        ctx.restore();
    };

    useEffect(() => {
        if (activeTab === 'image') drawImage();
    }, [image, imgScale, imgPos, imgTargetDims, activeTab]);

    const handleImgMouseDown = (e) => {
        if (!image) return;
        isDragging.current = true;
        dragStart.current = { x: e.clientX - imgPos.x, y: e.clientY - imgPos.y };
    };
    const handleImgMouseMove = (e) => {
        if (!isDragging.current || !image) return;
        e.preventDefault();
        setImgPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const handleImgMouseUp = () => { isDragging.current = false; };

    const handleImageDownload = () => {
        if (!image) return;
        setLoading(true);
        // Simple download logic (current view)
        if (canvasRef.current) {
            const link = document.createElement('a');
            link.download = 'design-converted.png';
            link.href = canvasRef.current.toDataURL('image/png');
            link.click();
            toast({ title: t('common.success'), description: "Imagen descargada." });
        }
        setLoading(false);
    };


    // ==================== 3D LOGIC ====================

    // Initialize ThreeJS Scene
    useEffect(() => {
        if (activeTab !== '3d') return;
        if (!mountRef.current) return;

        // Cleanup previous scene if exists to avoid dupes
        if (rendererRef.current) {
            mountRef.current.innerHTML = '';
        }

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x151b23); // Dark localized bg
        scene.fog = new THREE.Fog(0x151b23, 10, 50);

        // Grid (Ground)
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        scene.add(gridHelper);

        // Lights
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        hemiLight.position.set(0, 20, 0);
        scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(5, 10, 7.5);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(0, 5, 10);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        mountRef.current.appendChild(renderer.domElement);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controlsRef.current = controls;

        // Save refs
        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;

        // Animation Loop
        let animationId;
        const animate = () => {
            animationId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Handle Resize
        const handleResize = () => {
            if (!mountRef.current) return;
            const newW = mountRef.current.clientWidth;
            const newH = mountRef.current.clientHeight;
            camera.aspect = newW / newH;
            camera.updateProjectionMatrix();
            renderer.setSize(newW, newH);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationId);
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
            // Basic cleanup
            renderer.dispose();
        };
    }, [activeTab]);

    // 3D UTILS
    const fitModelToView = (object) => {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Center the model
        object.position.sub(center);

        // Normalize scale (fit into a 10 unit box)
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 10;

        // Safety: Prevent division by zero if model is empty/point
        if (maxDim <= 0.0001) {
            console.warn("Model has zero dimension. Skipping auto-scale.");
            return object;
        }

        const scale = targetSize / maxDim;
        object.scale.setScalar(scale);

        // Reset position Y to sit on grid after scaling
        // Re-calculate box after scale implies dimensions changed
        const scaledSizeY = size.y * scale;
        object.position.y = scaledSizeY / 2;

        // Force Camera Focus
        if (controlsRef.current && cameraRef.current) {
            controlsRef.current.target.set(0, 0, 0);
            controlsRef.current.update();
            cameraRef.current.position.set(0, 5, 10);
            cameraRef.current.lookAt(0, 0, 0);
        }

        return object;
    };

    const handleCenterView = () => {
        if (controlsRef.current && cameraRef.current) {
            controlsRef.current.target.set(0, 0, 0);
            controlsRef.current.update();
            cameraRef.current.position.set(0, 5, 10);
            cameraRef.current.lookAt(0, 0, 0);
        }
    };

    const handle3DFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // 1. Separate Model from Textures
        let mainFile = null;
        const textureMap = new Map();

        // Supported 3D formats
        const modelExts = ['obj', 'fbx', 'glb', 'gltf', 'tm', 'udatasmith', 'skp'];

        files.forEach(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            if (modelExts.includes(ext)) {
                mainFile = f; // Take the first valid model found
            } else {
                // Assume it's a texture/asset
                textureMap.set(f.name.toLowerCase(), URL.createObjectURL(f));
                // Add without path too just in case
                textureMap.set(f.name.split('/').pop().toLowerCase(), URL.createObjectURL(f));
            }
        });

        if (!mainFile) {
            toast({ title: t('common.error'), description: "No se encontró un archivo 3D (.obj, .fbx) en la selección.", variant: "destructive" });
            return;
        }

        const extension = mainFile.name.split('.').pop().toLowerCase();

        // SIZE CHECK (Limit to 200MB)
        // SIZE CHECK (Limit to 200MB)
        if (mainFile.size > 200 * 1024 * 1024) {
            // Instead of window.confirm, set state to show custom Dialog
            setLargeFileToUpload(mainFile);
            e.target.value = ''; // Reset input
            return;
        }

        // TWINMOTION CHECKS
        if (extension === 'tm' || extension === 'udatasmith') {
            openGuide('twinmotion');
            e.target.value = null;
            return;
        }

        // SKETCHUP CHECK
        if (extension === 'skp') {
            toast({
                title: "Archivo SketchUp (.skp)",
                description: "Por favor exporta como .OBJ o .FBX desde SketchUp.",
                variant: "destructive"
            });
            e.target.value = null;
            return;
        }

        setModelFile(mainFile);
        setModelFile(mainFile);
        setLoading(true);
        setUploadStatus("Procesando archivo localmente en el navegador...");
        setProgress(0);
        progressStartTime.current = Date.now();

        // 2. Setup Loading Manager for Textures
        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
            // "url" might be "path/to/texture.png" or just "texture.png"
            // We need to match it against our flattened uploaded list

            // Normalize: remove relative paths, lower case
            let fileName = url.replace(/^.*[\\\/]/, '').toLowerCase(); // get basename

            if (textureMap.has(fileName)) {
                console.log(`Loading texture from upload: ${fileName}`);
                return textureMap.get(fileName);
            }

            return url;
        });

        const url = URL.createObjectURL(mainFile);

        // Clear previous
        if (modelObject) {
            sceneRef.current.remove(modelObject);
            setModelObject(null);
        }

        const onLoad = (object) => {
            try {
                console.log("Raw Loaded Object:", object);

                // 1. VALIDATE GEOMETRY
                let hasGeometry = false;
                object.traverse((child) => {
                    if (child.isMesh || child.isLine || child.isPoints) {
                        hasGeometry = true;
                        // Force visibility
                        child.visible = true;
                    }
                });

                if (!hasGeometry) {
                    throw new Error("El archivo 3D está vacío o no tiene geometría visible.");
                }

                // Fix visibility/materials
                // Fix visibility/materials & Upgrade to StandardMaterial for AR
                object.traverse((child) => {
                    if (child.isMesh) {
                        const oldMat = child.material;

                        // Create a new Standard material which works better for AR/GLB
                        // We preserve the map (texture) if it exists.
                        const newMat = new THREE.MeshStandardMaterial({
                            color: oldMat.color,
                            map: oldMat.map,
                            normalMap: oldMat.normalMap,
                            roughness: 0.6,
                            metalness: 0.2,
                            side: THREE.DoubleSide,
                            transparent: oldMat.transparent,
                            opacity: oldMat.opacity
                        });

                        // If it has NO texture map, we give it a nicer default appearance
                        // instead of pure white/black which looks fake.
                        if (!oldMat.map) {
                            // If original was pure black or pure white, make it "Industrial Grey"
                            const hex = oldMat.color ? oldMat.color.getHex() : 0xffffff;
                            if (hex === 0x000000 || hex === 0xffffff) {
                                newMat.color.setHex(0xbbbbbb); // Industrial silver
                            }
                        } else {
                            // If it DOES have a texture, ensure color is white so it doesn't tint the texture
                            newMat.color.setHex(0xffffff);
                        }

                        child.material = newMat;
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                const normalizedObj = fitModelToView(object);

                sceneRef.current.add(normalizedObj);
                setModelObject(normalizedObj);

                // Set default name
                const baseName = mainFile.name.replace(/\.[^/.]+$/, "");
                setSaveData(prev => ({ ...prev, name: baseName, projectId: projects[0]?.id || '' }));

                toast({ title: t('common.success'), description: "Modelo cargado y optimizado." });
            } catch (err) {
                console.error("Processing error:", err);
                toast({ title: "Error", description: "El modelo cargó pero falló al procesarse.", variant: "destructive" });
            } finally {
                setLoading(false);
                setProgress(0);
                setUploadStatus("");
            }
        };

        const onProgress = (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                setProgress(percentComplete);
            }
        };

        const onError = (err) => {
            clearTimeout(loadTimeout);
            console.error(err);
            setLoading(false);
            setProgress(0);
            toast({ title: t('common.error'), description: "Error al leer el archivo. Intenta con otro formato.", variant: "destructive" });
        };

        // Safety Timeout (60s)
        const loadTimeout = setTimeout(() => {
            if (loading) {
                setLoading(false);
                setProgress(0);
                toast({ title: "Tiempo excedido", description: "La carga tardó demasiado. Intenta con un archivo más ligero.", variant: "destructive" });
                setUploadStatus("Error: Tiempo de espera agotado.");
            }
        }, 60000);

        // Wrap onLoad to clear timeout
        const safeOnLoad = (obj) => {
            clearTimeout(loadTimeout);
            onLoad(obj);
        };

        if (extension === 'obj') {
            new OBJLoader(manager).load(url, safeOnLoad, onProgress, onError);
        } else if (extension === 'fbx') {
            new FBXLoader(manager).load(url, safeOnLoad, onProgress, onError);
        } else if (extension === 'glb' || extension === 'gltf') {
            // Basic support for re-uploading GLBs
            new GLTFLoader(manager).load(url, (gltf) => safeOnLoad(gltf.scene), onProgress, onError);
        } else {
            clearTimeout(loadTimeout);
            setLoading(false);
            toast({ title: t('common.error'), description: "Formato no soportado.", variant: "destructive" });
        }
    };

    // LOAD FROM LIBRARY
    const handleLoadModel = (model) => {
        if (!model.file_url) return;
        setLoading(true);
        const url = model.file_url;
        const ext = model.type ? model.type.toLowerCase() : url.split('.').pop().toLowerCase();

        // Clear previous
        if (modelObject) {
            sceneRef.current.remove(modelObject);
            setModelObject(null);
        }

        const onLibraryLoad = (object) => {
            // Handle scene unpacking for GLTF vs raw Object for FBX/OBJ
            let finalObject = object;
            if (object.scene) finalObject = object.scene; // GLTF

            try {
                // Shared processing
                finalObject.traverse((child) => {
                    if (child.isMesh) {
                        const oldMat = child.material;
                        const newMat = new THREE.MeshStandardMaterial({
                            color: oldMat.color,
                            map: oldMat.map,
                            normalMap: oldMat.normalMap,
                            roughness: 0.6,
                            metalness: 0.2,
                            side: THREE.DoubleSide
                        });
                        if (!oldMat.map) {
                            const hex = oldMat.color ? oldMat.color.getHex() : 0xffffff;
                            if (hex === 0x000000 || hex === 0xffffff) newMat.color.setHex(0xbbbbbb);
                        } else {
                            newMat.color.setHex(0xffffff);
                        }
                        child.material = newMat;
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                const normalizedObj = fitModelToView(finalObject);
                sceneRef.current.add(normalizedObj);
                setModelObject(normalizedObj);
                setSaveData(prev => ({ ...prev, name: model.name, projectId: model.project_id }));
                toast({ title: "Cargado", description: `Modelo "${model.name}" cargado desde librería.` });
            } catch (err) {
                console.error(err);
                toast({ title: "Error", description: "Error procesando modelo.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        const onLibraryError = (err) => {
            console.error(err);
            setLoading(false);
            toast({ title: "Error", description: "No se pudo descargar el modelo.", variant: "destructive" });
        };

        // Select Loader
        if (ext === 'fbx') {
            new FBXLoader().load(url, onLibraryLoad, undefined, onLibraryError);
        } else if (ext === 'obj') {
            new OBJLoader().load(url, onLibraryLoad, undefined, onLibraryError);
        } else {
            // Default GLB/GLTF
            new GLTFLoader().load(url, onLibraryLoad, undefined, onLibraryError);
        }
    };

    // GENERATE GLB BLOB
    const generateGLB = () => {
        return new Promise((resolve, reject) => {
            if (!modelObject) {
                reject(new Error("No model loaded"));
                return;
            }
            const exporter = new GLTFExporter();
            exporter.parse(
                modelObject,
                (gltf) => {
                    const blob = new Blob([gltf], { type: 'application/octet-stream' });
                    resolve(blob);
                },
                (error) => reject(error),
                { binary: true }
            );
        });
    };

    const handleDownloadGLB = async () => {
        if (!modelObject) return;
        setLoading(true);
        try {
            const blob = await generateGLB();
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = modelFile ? modelFile.name.replace(/\.[^/.]+$/, "") + '.glb' : 'model.glb';
            link.click();
            toast({ title: t('converter.conversionSuccess'), description: "Tu archivo GLB se ha descargado." });
        } catch (error) {
            console.error('Error exporting GLB:', error);
            toast({ title: t('converter.conversionError'), description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const confirmSaveToProject = async () => {
        // Validation: Name is required. ProjectID is required ONLY if we have projects.
        // If no projects, we will auto-create one.
        if (!saveData.name) {
            toast({ title: "Error", description: "Ingresa un nombre para el modelo", variant: "destructive" });
            return;
        }

        setShowSaveDialog(false);
        setLoading(true);
        setProgress(10); // Start progress
        toast({ title: t('converter.saving'), description: "Procesando modelo..." });

        try {
            let targetProjectId = saveData.projectId;

            // AUTO-CREATE PROJECT IF NONE SELECTED (or none exist)
            if (!targetProjectId) {
                // Default project name if user didn't specify one (though we might add an input for it)
                const newProjName = "Mi Primer Proyecto";
                const newProject = await projectsService.create({
                    name: newProjName,
                    description: "Proyecto creado automáticamente desde el Convertidor"
                });
                targetProjectId = newProject.id;
                // Update local state to reflect new project immediately
                setProjects(prev => [newProject, ...prev]);
            }

            setProgress(30);

            // 1. Generate Blob
            const blob = await generateGLB();
            if (!blob || blob.size === 0) throw new Error("Error generando archivo GLB (vacío).");

            setProgress(60);

            const fileName = `${saveData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.glb`;
            const file = new File([blob], fileName, { type: 'application/octet-stream' });

            // 2. Upload to Supabase Storage
            const publicUrl = await storageService.uploadFile('models', `${user.id}/${targetProjectId}/${fileName}`, file);

            setProgress(85);

            // 3. Create Model Record
            await modelsService.create({
                name: saveData.name,
                project_id: targetProjectId,
                file_url: publicUrl,
                type: 'glb',
                size: blob.size,
                status: 'ready'
            });

            setProgress(100);

            toast({ title: t('common.success'), description: t('converter.saveSuccess') });

        } catch (error) {
            console.error(error);
            toast({ title: t('common.error'), description: "Error guardando: " + error.message, variant: "destructive" });
        } finally {
            setLoading(false);
            setProgress(0);
            setUploadStatus("");
        }
    };

    // DIRECT UPLOAD FOR LARGE FILES
    const handleDirectUpload = async (file) => {
        setLoading(true);
        setUploadStatus("Iniciando subida directa al servidor (No cierres esta ventana)...");
        setProgress(5);
        toast({ title: "Subiendo archivo...", description: "Esto puede tardar unos minutos dependiendo de tu conexión." });

        try {
            // Default project
            let targetProjectId = projects[0]?.id;

            if (!targetProjectId) {
                const newProjName = "Mi Primer Proyecto";
                const newProject = await projectsService.create({
                    name: newProjName,
                    description: "Proyecto creado automáticamente"
                });
                targetProjectId = newProject.id;
                setProjects(prev => [newProject, ...prev]);
            }

            setProgress(15);
            setUploadStatus("Subiendo archivo a la nube... " + (file.size / (1024 * 1024)).toFixed(0) + "MB");

            // Upload Raw File
            const fileName = `${file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

            const onUploadProgress = (pc) => {
                setProgress(Math.round(pc));
                setUploadStatus(`Subiendo archivo a la nube... ${Math.round(pc)}% (${(file.size / (1024 * 1024)).toFixed(0)}MB)`);
            };

            const publicUrl = await storageService.uploadFile('models', `${user.id}/${targetProjectId}/${fileName}`, file, onUploadProgress);

            setProgress(95);
            setUploadStatus("Registrando modelo en base de datos...");

            // Create Model Record (using original extension as type)
            const ext = file.name.split('.').pop().toLowerCase();
            await modelsService.create({
                name: file.name,
                project_id: targetProjectId,
                file_url: publicUrl,
                type: ext, // 'fbx', 'obj'
                size: file.size,
                status: 'raw'
            });

            setProgress(100);
            setUploadStatus("¡Completado!");
            toast({ title: "Archivo Guardado", description: "Se subió correctamente. Puedes intentar abrirlo desde 'Tu Librería'." });

            // Refresh library
            setTimeout(() => window.location.reload(), 1500); // Simple refresh to show new model

        } catch (error) {
            console.error("Direct Upload Error:", error);

            // Check for RLS/Permission errors
            if (error.message.includes("row-level security") || error.message.includes("403") || error.message.includes("Unauthorized")) {
                toast({
                    title: "Acceso Denegado",
                    description: "No tienes permiso para subir archivos a la nube. Probablemente necesites iniciar sesión.",
                    variant: "destructive",
                    duration: 5000
                });
                setUploadStatus("Error: Requiere Inicio de Sesión");
            } else {
                toast({ title: "Error al subir", description: error.message, variant: "destructive" });
                setUploadStatus("Error en la subida: " + error.message);
            }
        } finally {
            setLoading(false);
            setProgress(0);
            // setUploadStatus(""); 
        }
    };


    return (
        <>
            {/* LARGE FILE UPLOAD CONFIRMATION DIALOG */}
            <Dialog open={!!largeFileToUpload} onOpenChange={(open) => !open && setLargeFileToUpload(null)}>
                <DialogContent className="bg-[#1c2430] border-gray-700 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl text-yellow-400 flex items-center gap-2">
                            <AlertCircle className="w-6 h-6" />
                            Archivo Muy Pesado
                        </DialogTitle>
                        <DialogDescription className="text-gray-300 pt-4">
                            El archivo <strong>{largeFileToUpload?.name}</strong> pesa <strong>{(largeFileToUpload?.size / (1024 * 1024)).toFixed(0)}MB</strong>.
                            <br /><br />
                            Intentar visualizarlo aquí podría colgar tu navegador.
                            <br /><br />
                            ¿Deseas <strong>subirlo directamente</strong> a tu librería para guardarlo?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setLargeFileToUpload(null)}
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => {
                                handleDirectUpload(largeFileToUpload);
                                setLargeFileToUpload(null);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Upload className="w-4 h-4 mr-2" />
                            Subir Directamente
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Helmet>
                <title>{t('converter.title')} - VISOR-X</title>
            </Helmet>

            {/* DIALOG COMPONENT */}
            <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
                <DialogContent className="bg-[#151B23] border-[#29B6F6]/20 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[#29B6F6]">
                            <RotateCw className="h-5 w-5" />
                            {helpContent?.title}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        {helpContent?.description}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setShowHelpDialog(false)} className="bg-[#29B6F6] text-[#0B0F14] hover:bg-[#29B6F6]/90 w-full sm:w-auto">
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="border-b border-[#29B6F6]/20 bg-[#151B23] p-4 shrink-0">
                    <div className="container mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white" title={t('common.back')}>
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <RotateCw className="h-5 w-5 text-[#29B6F6]" />
                                {t('converter.title')}
                            </h1>
                            <Button onClick={() => openGuide('general')} variant="ghost" size="sm" className="hidden md:flex text-gray-500 hover:text-[#29B6F6] text-xs gap-1 border border-white/5">
                                <span>?</span> {t('converter.help')}
                            </Button>
                        </div>

                        {/* Tabs Trigger in Header for quick switch */}
                        <div className="bg-[#0B0F14] p-1 rounded-lg border border-white/10 hidden sm:block">
                            <div className="flex gap-1">
                                <Button
                                    size="sm"
                                    variant={activeTab === 'image' ? "secondary" : "ghost"}
                                    onClick={() => setActiveTab('image')}
                                    className="text-xs"
                                >
                                    <ImageIcon className="h-3 w-3 mr-2" />
                                    {t('converter.tab2d')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant={activeTab === '3d' ? "secondary" : "ghost"}
                                    onClick={() => setActiveTab('3d')}
                                    className="text-xs"
                                >
                                    <BoxIcon className="h-3 w-3 mr-2" />
                                    {t('converter.tab3d')}
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {activeTab === 'image' ? (
                                <>
                                    <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="text-xs border-[#29B6F6]/30 text-[#29B6F6] hover:bg-[#29B6F6]/10">
                                        <Upload className="h-3 w-3 mr-2" /> {t('converter.uploadImage')}
                                    </Button>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageFileChange} />

                                    <Button onClick={handleImageDownload} disabled={!image || loading} className="text-xs bg-[#29B6F6] text-[#0B0F14] hover:bg-[#29B6F6]/90">
                                        <Save className="h-3 w-3 mr-2" /> {t('common.save')}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button onClick={() => fileInput3DRef.current?.click()} variant="outline" className="text-xs border-[#29B6F6]/30 text-[#29B6F6] hover:bg-[#29B6F6]/10">
                                        <Upload className="h-3 w-3 mr-2" /> {t('converter.uploadModel')} (+ Texturas)
                                    </Button>
                                    <input ref={fileInput3DRef} type="file" className="hidden" multiple accept=".obj,.fbx,.tm,.udatasmith,.skp,.png,.jpg,.jpeg,.tga,.bmp" onChange={handle3DFileChange} />

                                    <div className="flex gap-1">
                                        <Button onClick={handleCenterView} disabled={!modelObject} variant="secondary" className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20" title="Centrar Cámara">
                                            <ZoomIn className="h-3 w-3 mr-2" /> Centrar
                                        </Button>
                                        <Button onClick={handleOpenAR} disabled={!modelObject || loading} variant="secondary" className="text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20" title="Ver con cámara">
                                            <Camera className="h-3 w-3 mr-2" /> AR
                                        </Button>
                                        <Button onClick={() => setShowSaveDialog(true)} disabled={!modelObject || loading} className="text-xs bg-[#29B6F6]/20 text-[#29B6F6] hover:bg-[#29B6F6]/30 border border-[#29B6F6]/50">
                                            <Save className="h-3 w-3 mr-2" /> {t('converter.saveToProject')}
                                        </Button>
                                        <Button onClick={handleDownloadGLB} disabled={!modelObject || loading} variant="outline" className="text-xs border-white/20 text-gray-300 hover:bg-white/10">
                                            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Upload className="h-3 w-3 mr-2 rotate-180" />}
                                            {t('common.download')}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Mobile Tabs (if screen small) */}
                <div className="sm:hidden p-2 bg-[#151B23] flex justify-center border-b border-white/5 shrink-0">
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={activeTab === 'image' ? "secondary" : "ghost"}
                            onClick={() => setActiveTab('image')}
                            className="text-xs h-8"
                        >
                            {t('converter.tab2d')}
                        </Button>
                        <Button
                            size="sm"
                            variant={activeTab === '3d' ? "secondary" : "ghost"}
                            onClick={() => setActiveTab('3d')}
                            className="text-xs h-8"
                        >
                            {t('converter.tab3d')}
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden">

                    {/* --- IMAGE MODE --- */}
                    {activeTab === 'image' && (
                        <>
                            <aside className="w-80 bg-[#151B23] border-r border-white/10 p-6 flex flex-col gap-8 z-10 overflow-y-auto shrink-0">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">Configuración de Salida</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500">Ancho</label>
                                            <input
                                                type="number"
                                                className="w-full bg-[#0B0F14] border border-white/10 rounded px-2 py-1.5 text-sm focus:border-[#29B6F6] outline-none"
                                                value={imgTargetDims.width}
                                                onChange={(e) => setImgTargetDims(p => ({ ...p, width: Number(e.target.value) }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500">Alto</label>
                                            <input
                                                type="number"
                                                className="w-full bg-[#0B0F14] border border-white/10 rounded px-2 py-1.5 text-sm focus:border-[#29B6F6] outline-none"
                                                value={imgTargetDims.height}
                                                onChange={(e) => setImgTargetDims(p => ({ ...p, height: Number(e.target.value) }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">Ajuste Visual</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <span>Zoom: {Math.round(imgScale * 100)}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <ZoomOut className="h-3 w-3 text-gray-500" />
                                            <Slider
                                                value={[imgScale]}
                                                min={0.1}
                                                max={3}
                                                step={0.1}
                                                onValueChange={(val) => setImgScale(val[0])}
                                                className="flex-1"
                                            />
                                            <ZoomIn className="h-3 w-3 text-gray-500" />
                                        </div>
                                        <Button variant="secondary" size="sm" className="w-full text-xs" onClick={() => { setImgScale(1); setImgPos({ x: 0, y: 0 }); }}>
                                            Resetear Vista
                                        </Button>
                                    </div>
                                </div>
                            </aside>
                            <main
                                className="flex-1 bg-[#05080A] relative overflow-hidden flex items-center justify-center cursor-move"
                                onMouseDown={handleImgMouseDown}
                                onMouseMove={handleImgMouseMove}
                                onMouseUp={handleImgMouseUp}
                                onMouseLeave={handleImgMouseUp}
                                ref={imgContainerRef}
                            >
                                {!image && (
                                    <div className="text-center pointer-events-none select-none opacity-50">
                                        <ImageIcon className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                                        <p className="text-gray-500">{t('converter.uploadImage')}</p>
                                    </div>
                                )}
                                <div
                                    className="relative shadow-2xl overflow-hidden bg-white/5 border border-white/10"
                                    style={{
                                        width: imgTargetDims.width,
                                        height: imgTargetDims.height,
                                        transform: `scale(${Math.min(
                                            (imgContainerRef.current?.clientWidth - 100) / imgTargetDims.width || 1,
                                            (imgContainerRef.current?.clientHeight - 100) / imgTargetDims.height || 1
                                        )})`
                                    }}
                                >
                                    <canvas ref={canvasRef} width={imgTargetDims.width} height={imgTargetDims.height} className="block" />
                                </div>
                            </main>
                        </>
                    )}

                    {/* --- 3D MODE --- */}
                    {activeTab === '3d' && (
                        <>
                            <aside className="w-80 bg-[#151B23] border-r border-white/10 flex flex-col z-10 overflow-y-auto shrink-0">

                                {/* LIBRARY SECTION */}
                                <div className="p-4 border-b border-white/10">
                                    <h3 className="text-xs font-bold text-[#29B6F6] uppercase mb-3 flex items-center gap-2">
                                        <Save className="h-3 w-3" /> Tu Librería
                                    </h3>
                                    {userModels.length > 0 ? (
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                            {userModels.map(m => (
                                                <div
                                                    key={m.id}
                                                    onClick={() => handleLoadModel(m)}
                                                    className="group flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer border border-transparent hover:border-[#29B6F6]/30 transition-all"
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <BoxIcon className="h-4 w-4 text-gray-500 group-hover:text-[#29B6F6]" />
                                                        <div className="truncate">
                                                            <p className="text-xs text-white font-medium truncate">{m.name}</p>
                                                            <p className="text-[10px] text-gray-500 truncate">{new Date(m.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 bg-white/5 rounded border border-white/5 border-dashed">
                                            <p className="text-xs text-gray-500">No hay modelos guardados.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 flex flex-col gap-4">
                                    {/* GUIDES & STUFF */}
                                    <div className="bg-[#29B6F6]/5 border border-[#29B6F6]/20 rounded p-4">

                                        <h4 className="text-[#29B6F6] font-bold text-xs mb-2 uppercase flex items-center gap-2">
                                            <BoxIcon className="h-3 w-3" />
                                            Guía 3D
                                        </h4>
                                        <p className="text-xs text-gray-400 mb-2">
                                            SketchUp y Twinmotion no exportan web AR nativo. Esta herramienta convierte sus formatos estándar.
                                        </p>
                                        <ol className="text-xs text-gray-400 list-decimal list-inside space-y-1">
                                            <li>En tu programa 3D, exporta como <strong>.OBJ</strong> o <strong>.FBX</strong>.</li>
                                            <li>Sube el archivo aquí.</li>
                                            <li>Verifica que se vea bien en el visor.</li>
                                            <li>Presiona <strong>"{t('converter.saveToProject')}"</strong> para guardarlo en tu cuenta.</li>
                                        </ol>
                                    </div>

                                    {modelObject && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-white uppercase">Propiedades</h4>
                                            <div className="bg-[#0B0F14] p-3 rounded text-xs space-y-1 text-gray-400 font-mono">
                                                <p>Vertices: N/A</p>
                                                <p>Children: {modelObject.children.length}</p>
                                                <p>Type: {modelObject.type}</p>
                                            </div>
                                        </div>
                                    )}

                                    {loading && (
                                        <div className="flex flex-col items-center justify-center py-6 text-center animate-pulse bg-[#29B6F6]/5 rounded border border-[#29B6F6]/20 p-4">
                                            <Loader2 className="h-6 w-6 text-[#29B6F6] animate-spin mb-3" />
                                            <p className="text-xs text-[#29B6F6] font-bold mb-2">
                                                {uploadStatus || (progress > 0 && progress < 100 ? `Cargando... ${progress}%` : t('converter.converting'))}
                                            </p>

                                            {/* Progress Bar Track */}
                                            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#29B6F6] transition-all duration-300 ease-out"
                                                    style={{ width: `${Math.max(progress, 5)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-2">Esto puede tomar unos segundos.</p>
                                        </div>
                                    )}
                                </div>
                            </aside>
                            <main
                                className="flex-1 bg-[#05080A] relative"
                                ref={mountRef}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files[0];
                                    if (file && fileInput3DRef.current) {
                                        // Create a fake event to reuse the handler
                                        const event = { target: { files: [file], value: '' } };
                                        handle3DFileChange(event);
                                    }
                                }}
                            >
                                {/* Three JS Canvas creates itself here */}
                                {!modelObject && !loading && (
                                    <div
                                        onClick={() => fileInput3DRef.current?.click()}
                                        className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
                                    >
                                        <div className="text-center opacity-40">
                                            <BoxIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                                            <h3 className="text-xl font-bold text-gray-500">{t('converter.emptyTitle')}</h3>
                                            <p className="text-sm text-gray-600">{t('converter.emptyDesc')}</p>
                                        </div>
                                    </div>
                                )}
                            </main>
                        </>
                    )}

                </div>
            </div>

            {/* SAVE TO PROJECT DIALOG */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent className="bg-[#151B23] border-[#29B6F6]/20 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Save className="h-5 w-5 text-[#29B6F6]" />
                            {t('converter.saveToProject')}
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Guarda el modelo convertido (GLB) directamente en tu librería.
                        </DialogDescription>
                    </DialogHeader>

                    {isSupabaseConfigured() ? (
                        <>
                            {projects.length > 0 ? (
                                <div className="space-y-4 py-2">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{t('converter.modelName')}</label>
                                        <input
                                            className="w-full bg-[#0B0F14] border border-[#29B6F6]/20 rounded px-3 py-2 text-white focus:border-[#29B6F6] outline-none"
                                            value={saveData.name}
                                            onChange={(e) => setSaveData(p => ({ ...p, name: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{t('converter.selectProject')}</label>
                                        <select
                                            className="w-full bg-[#0B0F14] border border-[#29B6F6]/20 rounded px-3 py-2 text-white focus:border-[#29B6F6] outline-none"
                                            value={saveData.projectId}
                                            onChange={(e) => setSaveData(p => ({ ...p, projectId: e.target.value }))}
                                        >
                                            <option value="" disabled>-- {t('converter.selectProject')} --</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 py-2">
                                    <div className="bg-[#29B6F6]/10 border border-[#29B6F6]/30 p-3 rounded flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-[#29B6F6] shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-[#29B6F6]">Primer Proyecto</h4>
                                            <p className="text-xs text-gray-400">
                                                No tienes proyectos aún. Crearemos uno nuevo llamado <strong>"Mi Primer Proyecto"</strong> automáticamente para guardar tu modelo.
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">{t('converter.modelName')}</label>
                                        <input
                                            className="w-full bg-[#0B0F14] border border-[#29B6F6]/20 rounded px-3 py-2 text-white focus:border-[#29B6F6] outline-none"
                                            value={saveData.name}
                                            onChange={(e) => setSaveData(p => ({ ...p, name: e.target.value }))}
                                            placeholder="Ej. Silla de Oficina"
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-yellow-500 mb-2">Supabase no está configurado.</p>
                            <p className="text-xs text-gray-500">Solo puedes descargar archivos localmente.</p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowSaveDialog(false)} className="text-gray-400 hover:text-white">
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={confirmSaveToProject}
                            disabled={!saveData.name || loading || !isSupabaseConfigured() || (projects.length > 0 && !saveData.projectId)}
                            className="bg-[#29B6F6] text-[#0B0F14] hover:bg-[#29B6F6]/90"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* AR PREVIEW DIALOG */}
            <Dialog open={showAR} onOpenChange={setShowAR}>
                <DialogContent className="bg-[#151B23] border-[#29B6F6]/20 text-white sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Camera className="h-5 w-5 text-[#29B6F6]" />
                            Previsualización AR
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Usa tu cámara o mueve el modelo para ver cómo quedaría.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="w-full h-[400px] bg-black/50 rounded-lg overflow-hidden border border-white/10 relative">
                        {arBlobUrl && (
                            <model-viewer
                                src={arBlobUrl}
                                ar
                                ar-modes="webxr scene-viewer quick-look"
                                camera-controls
                                auto-rotate
                                shadow-intensity="1"
                                style={{ width: '100%', height: '100%' }}
                            >
                                <div slot="ar-button" className="absolute bottom-4 right-4">
                                    <Button className="bg-[#29B6F6] text-black hover:bg-[#29B6F6]/90 shadow-lg">
                                        <Camera className="h-4 w-4 mr-2" /> Activar Cámara
                                    </Button>
                                </div>
                            </model-viewer>
                        )}
                    </div>

                    <DialogFooter>
                        <div className="text-[10px] text-gray-500 text-left w-full">
                            * AR requiere un dispositivo compatible (Android con ARCore o iOS con ARKit) o un navegador de escritorio con WebXR.
                        </div>
                        <Button onClick={() => setShowAR(false)} variant="ghost">Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default Converter;
