import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Save, ZoomIn, ZoomOut, Image as ImageIcon, Box as BoxIcon, Loader2, RotateCw, AlertCircle, Camera, Search, Trash2, Eye, X, Settings, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { projectsService, modelsService, storageService } from '@/lib/data-service';
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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter'; // For iOS AR
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader';
import JSZip from 'jszip'; // For ZIP support



function Converter() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { t } = useLanguage();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState("3d"); // Default to 3D per user request
    const [showLibrary, setShowLibrary] = useState(false); // Library sidebar toggle
    const [disableFog, setDisableFog] = useState(false); // Fog toggle
    const [showGuide, setShowGuide] = useState(false); // Guide toggle
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0); // Progress 0-100
    const [projects, setProjects] = useState([]);

    // ... refs

    // FOG TOGGLE EFFECT
    useEffect(() => {
        if (!sceneRef.current) return;
        if (disableFog) {
            sceneRef.current.fog = null;
        } else {
            sceneRef.current.fog = new THREE.Fog(0x151b23, 200, 100000); // Re-enable fog
        }
    }, [disableFog]);
    const [userModels, setUserModels] = useState([]); // List of saved models
    const [uploadStatus, setUploadStatus] = useState(""); // Specific status message for loading overlay
    const [searchTerm, setSearchTerm] = useState(""); // Search filter
    const [isDragging, setIsDragging] = useState(false); // Drag & Drop state

    // DIALOG STATES
    const [showHelpDialog, setShowHelpDialog] = useState(false);
    const [helpContent, setHelpContent] = useState(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showUploadDialog, setShowUploadDialog] = useState(false);

    // CONTROL PANEL STATE
    const [isRxMode, setIsRxMode] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Model Params
    const [color, setColor] = useState("#ffffff");
    const [modelColor, setModelColor] = useState("#ffffff"); // Kept for compat
    const [rotation, setRotation] = useState(0);
    const [verticalPos, setVerticalPos] = useState(0); // Replaces modelY

    const [saveData, setSaveData] = useState({ name: '', projectId: '' });
    const [largeFileToUpload, setLargeFileToUpload] = useState(null);

    // LOAD PROJECTS & MODELS
    useEffect(() => {
        if (user) {
            loadAllData();
        }
    }, [user]);

    const loadAllData = async () => {
        try {
            console.log("Debug: Starting loadAllData...");

            // Check session first
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn("Debug: No active session found during loadAllData");
            } else {
                console.log("Debug: Active session found for user:", session.user.email);
            }

            // Parallel Fetching for Speed using the new getAll method
            const [projs, allModels] = await Promise.all([
                projectsService.getAll(),
                modelsService.getAll()
            ]);

            setProjects(projs);
            setUserModels(allModels);
            if (activeTab === '3d' && showSaveDialog) {
                // If we just saved, scroll to top or finding the new model could be improved in future
            }

            console.log(`Debug: User ${user?.id} found ${projs.length} projects, ${allModels.length} models`);
            // console.log("Debug: Models List:", allModels);

            // Explicit feedback for debugging
            toast({
                title: "Librería Actualizada",
                description: `Encontrados: ${allModels.length} modelos.`,
                variant: "default"
            });
        } catch (e) {
            console.error("Error loading library:", e);
            toast({
                title: "Error de Librería",
                description: "Fallo de conexión: " + e.message,
                variant: "destructive"
            });
        }
    };

    // AR HANDLER
    const [showAR, setShowAR] = useState(false);
    const [arBlobUrl, setArBlobUrl] = useState(null);

    const handleOpenAR = async () => {
        if (!modelObject) return;
        setLoading(true);
        setIsGeneratingAR(true);
        try {
            // 1. Generate GLB (Android/WebXR)
            const glbBlob = await generateGLB();
            const glbUrl = URL.createObjectURL(glbBlob);
            setArBlobUrl(glbUrl);

            // 2. Generate USDZ (iOS Quick Look)
            const usdzBlob = await new Promise((resolve, reject) => {
                const exporter = new USDZExporter();
                exporter.parse(modelObject, (result) => {
                    const blob = new Blob([result], { type: 'model/vnd.usdz+zip' });
                    resolve(blob);
                }, (err) => reject(err));
            });
            const usdzUrl = URL.createObjectURL(usdzBlob);
            setIosSrc(usdzUrl);

            setShowAR(true);
        } catch (error) {
            console.error("AR Error:", error);
            toast({ title: "Error AR", description: "No se pudo preparar el modelo para AR.", variant: "destructive" });
        } finally {
            setLoading(false);
            setIsGeneratingAR(false);
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
    const isPanning = useRef(false); // Renamed from isDragging to avoid conflict
    const panStart = useRef({ x: 0, y: 0 });

    // --- 3D STATE ---
    const [modelFile, setModelFile] = useState(null);
    const [modelObject, setModelObject] = useState(null);
    const modelObjectRef = useRef(null); // Fix stale closure in animate
    const [modelStats, setModelStats] = useState(null); // New Stats State
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null); // Added ref for controls
    const fileInput3DRef = useRef(null);
    const progressStartTime = useRef(0); // Track start time for estimation

    // ROTATION STATE
    const [isAutoRotate, setIsAutoRotate] = useState(false);
    const [rotationAxis, setRotationAxis] = useState('y');
    const autoRotateRef = useRef(false);
    const rotationAxisRef = useRef('y');

    // AR STATE
    const [iosSrc, setIosSrc] = useState(null);
    const [isGeneratingAR, setIsGeneratingAR] = useState(false);

    // MOBILE UI STATE
    const [showMobileLibrary, setShowMobileLibrary] = useState(false);

    // HANDLERS FOR CONTROL PANEL (State defined above)
    const updateMaterialColor = (c) => {
        setColor(c);
        setModelColor(c); // Sync
        if (modelObject && !isRxMode) {
            modelObject.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    child.material.color.set(c);
                }
            });
        }
    };

    const updateVerticalPosition = (val) => {
        const y = val[0];
        setVerticalPos(y);
        if (modelObject) modelObject.position.y = y;
    };

    const handleRotationChange = (val) => {
        setRotation(val);
        if (modelObject) modelObject.rotation.y = val * (Math.PI / 180);
    };

    const restoreOriginalParams = () => {
        if (!modelObject) return;
        setColor("#ffffff");
        setModelColor("#ffffff");
        setVerticalPos(0);
        setRotation(0);
        setIsRxMode(false);

        modelObject.position.y = 0;
        modelObject.rotation.y = 0;

        // Restore materials
        modelObject.traverse((child) => {
            if (child.isMesh && child.userData.initialMat) {
                child.material = child.userData.initialMat.clone();
            }
        });
        toast({ title: "Restaurado", description: "Valores originales aplicados." });
    };

    // Sync refs for animation loop
    useEffect(() => {
        autoRotateRef.current = isAutoRotate;
        rotationAxisRef.current = rotationAxis;
    }, [isAutoRotate, rotationAxis]);

    // Sync model object ref
    useEffect(() => {
        modelObjectRef.current = modelObject;
    }, [modelObject]);

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
        isPanning.current = true;
        panStart.current = { x: e.clientX - imgPos.x, y: e.clientY - imgPos.y };
    };
    const handleImgMouseMove = (e) => {
        if (!isPanning.current || !image) return;
        e.preventDefault();
        setImgPos({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    };
    const handleImgMouseUp = () => { isPanning.current = false; };

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

        let animationId;

        // Cleanup previous scene if exists to avoid dupes
        if (rendererRef.current) {
            mountRef.current.innerHTML = '';
        }

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        if (width === 0 || height === 0) {
            console.warn("3D Container has 0 dimensions, retrying...");
            return;
        }

        let renderer;

        try {
            // Scene
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x151b23); // Dark localized bg
            if (!disableFog) {
                scene.fog = new THREE.Fog(0x151b23, 200, 100000);
            } else {
                scene.fog = null;
            }

            // Grid (Ground)
            const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
            scene.add(gridHelper);

            // Lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
            scene.add(ambientLight);
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
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
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
            const animate = () => {
                animationId = requestAnimationFrame(animate);

                // Auto Rotation Logic
                if (modelObjectRef.current && autoRotateRef.current) {
                    // Apply rotation based on selected axis
                    const axis = rotationAxisRef.current;
                    modelObjectRef.current.rotation[axis] += 0.01;
                }

                if (controls) controls.update();
                if (renderer && scene && camera) renderer.render(scene, camera);
            };
            animate();
        } catch (error) {
            console.error("ThreeJS Init Error:", error);
            // toast({ title: "Error 3D", description: "No se pudo iniciar el motor gráfico.", variant: "destructive" });
        }

        // Handle Resize
        const handleResize = () => {
            if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
            const newW = mountRef.current.clientWidth;
            const newH = mountRef.current.clientHeight;
            cameraRef.current.aspect = newW / newH;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(newW, newH);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animationId) cancelAnimationFrame(animationId);

            // Use local var if available, otherwise ref
            const rendererToDispose = renderer || rendererRef.current;

            if (mountRef.current && rendererToDispose && rendererToDispose.domElement) {
                // Check if child exists before removing
                if (mountRef.current.contains(rendererToDispose.domElement)) {
                    mountRef.current.removeChild(rendererToDispose.domElement);
                }
            }

            if (rendererToDispose) {
                rendererToDispose.dispose();
                rendererToDispose.forceContextLoss();
            }
            rendererRef.current = null;
        };
    }, [activeTab]);

    // 3D UTILS
    const fitModelToView = (object) => {
        // Force world matrix update to get accurate box
        object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // 1. Center the model (Critical for rotation)
        object.position.sub(center);

        // 2. DO NOT SCALE (Preserve Original Dimensions)
        // User requested: "escale a las medidas que tiene en mm" -> meaning keep original units.
        object.scale.setScalar(1);

        // 3. Move Camera to Fit Object
        const maxDim = Math.max(size.x, size.y, size.z);

        // Avoid zero-size issues
        if (maxDim <= 0.0001) return object;

        // SAFETY CHECK: Ensure Camera Exists
        if (!cameraRef.current) {
            console.warn("Camera not initialized, skipping auto-fit.");
            return object;
        }

        // Calculate distance to fit model in view
        // fov is 45 degrees. distance = size / (2 * tan(fov/2))
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

        // Clamp minimum zoom so we don't end up inside small objects
        if (cameraZ < 1) cameraZ = 2;

        if (controlsRef.current) {
            controlsRef.current.target.set(0, 0, 0);

            // Position camera up and front
            cameraRef.current.position.set(cameraZ * 0.5, cameraZ * 0.5, cameraZ);

            // Ensure far/near clipping planes can see it
            cameraRef.current.near = maxDim / 1000;
            cameraRef.current.far = maxDim * 100;
            cameraRef.current.updateProjectionMatrix();

            controlsRef.current.update();
        }

        // Update Stats with REAL dimensions
        setModelStats({
            x: size.x,
            y: size.y,
            z: size.z
        });

        return object;
    };

    // RX Mode Effect - Toggle Wireframe
    useEffect(() => {
        if (!modelObject) return;

        modelObject.traverse((child) => {
            if (child.isMesh) {
                if (isRxMode) {
                    // Save original if not already saved
                    if (!child.userData.originalMat) {
                        child.userData.originalMat = child.material;
                    }
                    // Apply RX/Wireframe Material
                    // White wireframe like the ironman image
                    // Apply RX/Wireframe Material
                    // Electric Blue Wireframe (#29B6F6)
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0x29B6F6,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.8
                    });
                } else {
                    // Restore original
                    if (child.userData.originalMat) {
                        child.material = child.userData.originalMat;
                    }
                }
            }
        });
    }, [isRxMode, modelObject]);

    // SAVE ORIGINAL MATERIALS ON LOAD (For Reset)
    useEffect(() => {
        if (!modelObject) return;
        modelObject.traverse((child) => {
            if (child.isMesh && child.material && !child.userData.initialMat) {
                // Clone deeply to ensure we have a true backup of the state right after load
                child.userData.initialMat = child.material.clone();
            }
        });
    }, [modelObject]);

    // Color Override Effect
    useEffect(() => {
        if (!modelObject || isRxMode) return;

        // Apply color if it's not default white
        if (color && color !== '#ffffff') {
            modelObject.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    child.material.color.set(color);
                }
            });
        }

        // Apply modelColor if it's set
        if (modelColor) {
            modelObject.traverse((child) => {
                if (child.isMesh && child.material && child.material.color) {
                    child.material.color.set(modelColor);
                }
            });
        }
    }, [color, modelColor, isRxMode, modelObject]);

    const handleManualTexture = (e) => {
        const file = e.target.files[0];
        if (!file || !modelObject) return;

        const url = URL.createObjectURL(file);
        const tex = new THREE.TextureLoader().load(url);
        tex.encoding = THREE.sRGBEncoding;

        modelObject.traverse((child) => {
            if (child.isMesh && child.material) {
                // We don't clone material here, just swap map
                child.material.map = tex;
                child.material.needsUpdate = true;
            }
        });
        toast({ title: "Textura Aplicada", description: "Se ha aplicado la textura al modelo." });
    };

    const handleResetStyle = () => {
        if (!modelObject) return;

        // 1. Reset States
        setIsRxMode(false);
        setModelColor(null); // No override

        // 2. Restore Materials
        modelObject.traverse((child) => {
            if (child.isMesh && child.userData.initialMat) {
                child.material = child.userData.initialMat.clone(); // Restore from backup
            }
        });

        // Reset file input if needed
        const fileInput = document.getElementById('manual-texture-upload');
        if (fileInput) fileInput.value = '';

        toast({ title: "Estilo Restaurado", description: "Se han recuperado los colores originales." });
    };

    const handleCenterView = () => {
        if (modelObject) {
            fitModelToView(modelObject);
            // Also reset Y manual offset when centering, or keep it? 
            // Usually centering resets position. Let's keep manual offset explicitly separate or re-apply it.
            // Actually fitModel centers geometry. The manual offset moves the WHOLE object group.
            setModelY(0);
        } else if (controlsRef.current) {
            controlsRef.current.reset();
        }
    };

    // Apply Y Position
    // Apply Y Position (Keep persistent on load)
    useEffect(() => {
        if (modelObject) {
            modelObject.position.y = verticalPos;
        }
    }, [verticalPos, modelObject]);

    // DRAG & DROP HANDLERS
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        processFiles(files);
    };

    const handle3DFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        processFiles(files);
    };

    // UNIFIED FILE PROCESSOR (Handles normal files + ZIP extraction)
    const processFiles = async (files) => {
        setLoading(true);
        setUploadStatus("Procesando archivos...");

        const extractedFiles = [];

        try {
            for (const file of files) {
                if (file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.rar')) {
                    setUploadStatus(`Extrayendo ${file.name}...`);
                    const zip = new JSZip();
                    const contents = await zip.loadAsync(file);

                    for (const filename of Object.keys(contents.files)) {
                        const zipEntry = contents.files[filename];
                        if (!zipEntry.dir) {
                            const blob = await zipEntry.async('blob');
                            // Fix: Clean filename to avoid path issues
                            const cleanName = filename.split('/').pop();
                            const extractedFile = new File([blob], cleanName, { type: blob.type });
                            extractedFiles.push(extractedFile);
                        }
                    }
                } else {
                    extractedFiles.push(file);
                }
            }
        } catch (err) {
            console.error("ZIP Error:", err);
            toast({ title: "Error ZIP", description: "No se pudo descomprimir el archivo.", variant: "destructive" });
            setLoading(false);
            return;
        }

        if (extractedFiles.length === 0) {
            setLoading(false);
            return;
        }

        // 1. Separate Model from Textures
        let mainFile = null;
        const textureMap = new Map();

        // Supported 3D formats
        const modelExts = ['obj', 'fbx', 'glb', 'gltf', 'tm', 'udatasmith', 'skp', 'dae'];

        console.log("--- PROCESSING FILES ---");
        extractedFiles.forEach(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            console.log(`File: ${f.name} (${ext})`);

            if (modelExts.includes(ext)) {
                if (!mainFile) mainFile = f; // Take the first valid model found
            } else {
                // Assume it's a texture/asset
                const objUrl = URL.createObjectURL(f);
                textureMap.set(f.name.toLowerCase(), objUrl);
                // Add without path too just in case
                const simpleName = f.name.split('/').pop().toLowerCase();
                textureMap.set(simpleName, objUrl);
                console.log(`-> Added to TextureMap: ${f.name} (and ${simpleName})`);
            }
        });

        if (!mainFile) {
            toast({ title: "Sin modelo", description: "No se encontró ningún archivo 3D compatible (.obj, .fbx, .glb, .dae) en lo que subiste.", variant: "destructive" });
            setLoading(false);
            return;
        }

        // SIZE CHECK (Limit to 200MB)
        if (mainFile.size > 200 * 1024 * 1024) {
            setLargeFileToUpload(mainFile);
            return;
        }

        // TWINMOTION & SKPC HECKS
        const ext = mainFile.name.split('.').pop().toLowerCase();
        if (ext === 'tm' || ext === 'udatasmith') { openGuide('twinmotion'); return; }
        if (ext === 'skp') { toast({ title: "Archivo SketchUp", description: "Exporta como .OBJ o .FBX", variant: "destructive" }); return; }

        setUploadStatus("Leyendo modelo 3D...");
        loadModelFile(mainFile, textureMap);
    };

    const loadModelFile = (mainFile, textureMap) => {
        setModelFile(mainFile);

        const url = URL.createObjectURL(mainFile);
        const extension = mainFile.name.split('.').pop().toLowerCase();

        // CLEANUP
        if (modelObject) {
            sceneRef.current.remove(modelObject);
            setModelObject(null);
        }

        // LOADING MANAGER
        const manager = new THREE.LoadingManager();
        // Register TGALoader for tga textures
        manager.addHandler(/\.tga$/i, new TGALoader(manager));

        manager.setURLModifier((url) => {
            // Check if URL is requested as a relative path filename
            // Handle both standard paths and encoded URIs if necessary
            const fileName = url.replace(/^.*[\\\/]/, '').toLowerCase();

            console.log(`[Manager] Requesting: ${url} -> Clean: ${fileName} `);

            // Allow matching cleaned name
            if (textureMap.has(fileName)) {
                console.log(`[Manager] HIT: Used blob for ${fileName}`);
                return textureMap.get(fileName);
            } else {
                // Try decoding URI component just in case
                try {
                    const decoded = decodeURIComponent(fileName);
                    if (textureMap.has(decoded)) {
                        console.log(`[Manager] HIT(Decoded): Used blob for ${decoded}`);
                        return textureMap.get(decoded);
                    }
                } catch (e) { }
            }

            console.log(`[Manager] MISS: ${fileName} `);
            return url;
        });

        const onProgress = (xhr) => {
            if (xhr.lengthComputable) {
                const percent = (xhr.loaded / xhr.total) * 100;
                setProgress(Math.round(percent));
                setUploadStatus(`Cargando modelo... ${Math.round(percent)}% `);
            }
        };

        const safeOnLoad = (obj) => {
            clearTimeout(loadTimeout);

            let finalObject = obj;
            if (obj.scene) finalObject = obj.scene;

            // Normalize and Add to Scene...
            try {
                finalObject.traverse((child) => {
                    // Do not force visibility - respect file settings
                    // if (child.isMesh || child.isLine || child.isPoints) child.visible = true;

                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;

                        // Improve existing materials if needed, but respect loaded textures
                        if (child.material) {
                            child.material.side = THREE.DoubleSide;

                            // Debug Textures
                            if (child.material.map) {
                                console.log(`Found texture map on mesh: ${child.name} `, child.material.map);
                                child.material.map.encoding = THREE.sRGBEncoding; // Ensure color correctness
                            } else {
                                // console.log(`No texture map on mesh: ${ child.name } `);
                            }

                            // Ensure standard material for better light
                            // Only replace if it's not already standard, to avoid losing specific properties
                            if (!child.material.isMeshStandardMaterial) {
                                const oldMat = child.material;

                                const newMatParams = {
                                    color: oldMat.color,
                                    transparent: oldMat.transparent,
                                    opacity: oldMat.opacity,
                                    side: THREE.DoubleSide,
                                    alphaTest: oldMat.alphaTest || 0,
                                };

                                // Validate MAP before assigning to prevent WebGL crashes
                                if (oldMat.map && oldMat.map.isTexture) {
                                    newMatParams.map = oldMat.map;
                                    newMatParams.map.needsUpdate = true;
                                }

                                child.material = new THREE.MeshStandardMaterial(newMatParams);
                            }
                        }
                    }
                });

                const normalizedObj = fitModelToView(finalObject);
                sceneRef.current.add(normalizedObj);
                setModelObject(normalizedObj);

                // Set default name for saving
                const baseName = mainFile.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
                setSaveData(prev => ({
                    ...prev,
                    name: baseName,
                    projectId: projects[0]?.id || ''
                }));

                setLoading(false);
                setUploadStatus("");
                toast({ title: "Cargado", description: "Archivo cargado correctamente." });
            } catch (e) {
                console.error(e);
                onError(e);
            }
        };

        const onError = (err) => {
            clearTimeout(loadTimeout);
            console.error(err);
            setLoading(false);
            setProgress(0);
            toast({ title: t('common.error'), description: "Error al leer el archivo.", variant: "destructive" });
        };

        // Safety Timeout (60s)
        const loadTimeout = setTimeout(() => {
            if (loading) {
                setLoading(false);
                setProgress(0);
                toast({ title: "Tiempo excedido", description: "La carga tardó demasiado.", variant: "destructive" });
                setUploadStatus("Error: Tiempo de espera agotado.");
            }
        }, 60000);

        if (extension === 'obj') {
            new OBJLoader(manager).load(url, safeOnLoad, onProgress, onError);
        } else if (extension === 'fbx') {
            new FBXLoader(manager).load(url, safeOnLoad, onProgress, onError);
        } else if (extension === 'dae') {
            // Collada needs specific scaling sometimes, but loader handles parsing
            new ColladaLoader(manager).load(url, (collada) => safeOnLoad(collada.scene), onProgress, onError);
        } else if (extension === 'glb' || extension === 'gltf') {
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

    // DELETE MODEL
    const handleDeleteModel = async (e, modelId) => {
        e.stopPropagation(); // Prevent loading the model
        if (!window.confirm("¿Estás seguro de que deseas eliminar este modelo?")) return;

        try {
            // Optimistic update
            setUserModels(prev => prev.filter(m => m.id !== modelId));

            await modelsService.delete(modelId);
            toast({ title: "Eliminado", description: "Modelo eliminado correctamente." });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "No se pudo eliminar el modelo.", variant: "destructive" });
            loadAllData(); // Revert
        }
    };

    // GENERATE GLB BLOB
    // GENERATE GLB BLOB (With Texture Recovery)
    const generateGLB = async () => {
        const parseGLB = (obj) => {
            return new Promise((resolve, reject) => {
                const exporter = new GLTFExporter();
                exporter.parse(
                    obj,
                    (gltf) => {
                        const blob = new Blob([gltf], { type: 'application/octet-stream' });
                        resolve(blob);
                    },
                    (error) => reject(error),
                    { binary: true }
                );
            });
        };

        if (!modelObject) throw new Error("No model loaded");

        try {
            return await parseGLB(modelObject);
        } catch (error) {
            console.warn("Standard export failed, attempting geometry-only export...", error);

            // Clone and strip textures
            const safeObj = modelObject.clone();
            safeObj.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.map = null;
                    child.material.normalMap = null;
                    child.material.roughnessMap = null;
                    child.material.metalnessMap = null;
                    // Ensure nice fallback color
                    child.material.color.setHex(0xaaaaaa);
                }
            });

            return await parseGLB(safeObj);
        }
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

        // Validate Project Selection if projects exist
        if (projects.length > 0 && !saveData.projectId) {
            toast({ title: "Falta Proyecto", description: "Por favor selecciona un proyecto de la lista.", variant: "destructive" });
            return;
        }

        // Debugging verification
        console.log("Starting save process...");
        if (!user) {
            console.error("No user in context");
            toast({ title: "Error de Sesión", description: "No se detecta usuario activo. Recarga la página.", variant: "destructive" });
            return;
        }

        setShowSaveDialog(false);
        setLoading(true);
        setProgress(10); // Start progress
        toast({ title: t('converter.saving'), description: "Iniciando proceso de guardado..." });

        try {
            let targetProjectId = saveData.projectId;
            const currentUser = user; // Use context user directly

            // AUTO-CREATE PROJECT IF NONE SELECTED
            // Make this robust: if creation fails, try to fetch first project or use fallback
            if (!targetProjectId) {
                try {
                    // Try strictly to find "Mi Primer Proyecto" first to avoid duplicates
                    if (projects.length > 0) {
                        targetProjectId = projects[0].id;
                    } else {
                        const newProjName = "Mi Primer Proyecto";
                        const newProject = await projectsService.create({
                            name: newProjName,
                            description: "Proyecto creado automáticamente desde el Convertidor"
                        });
                        targetProjectId = newProject.id;
                        setProjects(prev => [newProject, ...prev]);
                    }
                } catch (projErr) {
                    console.error("Auto-creation failed, using fallback ID:", projErr);
                    // Use a fallback so we don't block the user's hard work (model upload)
                    targetProjectId = 'default-project-' + Date.now();
                }
            }

            setProgress(30);

            // 1. Generate Blob
            const blob = await generateGLB();
            if (!blob || blob.size === 0) throw new Error("Error generando archivo GLB (vacío).");

            setProgress(60);

            const fileName = `${saveData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()} -${Date.now()}.glb`;
            const file = new File([blob], fileName, { type: 'application/octet-stream' });

            // 2. Upload to Supabase Storage
            // 2. Upload to Supabase Storage
            // 2. Upload to Supabase Storage
            const publicUrl = await storageService.uploadFile('models', `${currentUser.id}/${targetProjectId}/${fileName}`, file);

            // 2.5 Generate & Upload Thumbnail (Best Effort)
            try {
                if (mountRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
                    setUploadStatus("Generando miniatura...");
                    // Render current view to canvas
                    rendererRef.current.render(sceneRef.current, cameraRef.current);
                    const canvas = rendererRef.current.domElement;

                    // Convert to blob
                    const thumbBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.5));
                    if (thumbBlob) {
                        const thumbName = fileName.replace(/\.[^/.]+$/, "") + ".png";
                        await storageService.uploadFile('models', `${currentUser.id}/${targetProjectId}/${thumbName}`, thumbBlob);
                    }
                }
            } catch (thumbErr) {
                console.warn("Could not generate thumbnail", thumbErr);
                // Non-critical, continue
            }

            setProgress(85);

            // 3. Create Model Record
            await modelsService.create({
                name: saveData.name,
                project_id: targetProjectId,
                project_id: targetProjectId,
                // user_id: user.id, // Removed: Column does not exist in DB
                file_url: publicUrl,
                // size: blob.size, // Removed: Column does not exist in DB
                // status: 'ready' // Removed: Column does not exist in DB
                // size: blob.size, // Removed: Column does not exist in DB
            });

            setProgress(100);

            toast({ title: t('common.success'), description: t('converter.saveSuccess') });
            loadAllData(); // Refresh library immediately

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
            const fileName = `${file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()} `;

            const onUploadProgress = (pc) => {
                setProgress(Math.round(pc));
                setUploadStatus(`Subiendo archivo a la nube... ${Math.round(pc)}% (${(file.size / (1024 * 1024)).toFixed(0)}MB)`);
            };

            const publicUrl = await storageService.uploadFile('models', `${user.id} /${targetProjectId}/${fileName} `, file, onUploadProgress);

            setProgress(95);
            setUploadStatus("Registrando modelo en base de datos...");

            // Create Model Record (using original extension as type)
            const ext = file.name.split('.').pop().toLowerCase();
            await modelsService.create({
                name: file.name,
                project_id: targetProjectId,
                project_id: targetProjectId,
                // user_id: user.id, // Removed: Column does not exist in DB
                file_url: publicUrl,
                // size: file.size, // Removed: Column does not exist in DB
                // status: 'raw' // Removed: Column does not exist in DB
                // size: file.size, // Removed: Column does not exist in DB
            });

            setProgress(100);
            setUploadStatus("¡Completado!");
            toast({ title: "Archivo Guardado", description: "Se subió correctamente. Puedes intentar abrirlo desde 'Tu Librería'." });

            // Refresh library
            // Show in Viewer immediately using the correct loader
            handleLoadModel({
                file_url: publicUrl,
                name: file.name,
                type: ext,
                project_id: targetProjectId
            });

            // Refresh library list
            loadAllData();

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

                        <div className="hidden md:flex gap-2">
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
                                    <Button onClick={() => setShowUploadDialog(true)} variant="outline" className="text-xs border-[#29B6F6]/30 text-[#29B6F6] hover:bg-[#29B6F6]/10">
                                        <Upload className="h-3 w-3 mr-2" /> Subir ZIP / Pack
                                    </Button>
                                    <input ref={fileInput3DRef} type="file" className="hidden" multiple accept=".obj,.fbx,.dae,.tm,.udatasmith,.skp,.png,.jpg,.jpeg,.tga,.bmp,.zip,.rar" onChange={handle3DFileChange} />

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

                {/* STATUS BAR - Loading/Progress Feedback */}
                {(loading || uploadStatus) && (
                    <div className="w-full bg-[#151B23] border-b border-[#29B6F6]/20 p-2 flex items-center justify-center gap-3 text-xs text-[#29B6F6] animate-in slide-in-from-top-5 duration-300">
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        <span className="font-medium truncate max-w-[80vw] text-center">
                            {uploadStatus || "Procesando..."}
                        </span>
                        {progress > 0 && (
                            <span className="font-mono opacity-80 shrink-0">
                                {progress}%
                            </span>
                        )}
                    </div>
                )}

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
                                        )
                                            })`
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
                            {/* DRAG AND DROP OVERLAY */}
                            {isDragging && (
                                <div className="absolute inset-0 z-50 bg-[#29B6F6]/20 backdrop-blur-sm border-2 border-dashed border-[#29B6F6] flex items-center justify-center pointer-events-none">
                                    <div className="text-center bg-[#0B0F14] p-8 rounded-xl border border-[#29B6F6]">
                                        <Upload className="h-16 w-16 text-[#29B6F6] mx-auto mb-4 animate-bounce" />
                                        <h3 className="text-xl font-bold text-white">Sueltalo aquí</h3>
                                        <p className="text-[#29B6F6]">Modelos, Texturas o ZIP</p>
                                    </div>
                                </div>
                            )}

                            {/* MAIN VIEWPORT WITH DROP HANDLER */}
                            {/* Left Sidebar REMOVED - Moved content to Right Sidebar */}

                            <main
                                className="flex-1 bg-[#05080A] relative flex flex-col items-center justify-center overflow-hidden"
                                ref={mountRef}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {/* Three JS Canvas creates itself here */}
                                {!modelObject && !loading && (
                                    <div
                                        onClick={() => fileInput3DRef.current?.click()}
                                        className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors z-0"
                                    >
                                        <div className="text-center opacity-40">
                                            <BoxIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                                            <h3 className="text-xl font-bold text-gray-500">{t('converter.emptyTitle')}</h3>
                                            <p className="text-sm text-gray-600">{t('converter.emptyDesc')}</p>
                                        </div>
                                    </div>
                                )}
                            </main>

                            {/* RIGHT CONTROL SIDEBAR */}
                            {/* Mobile Backdrop */}
                            {showControls && (
                                <div
                                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"

                                    onClick={() => setShowControls(false)}
                                />
                            )}

                            <aside className={`
                                fixed inset-y-0 right-0 z-50 w-72 bg-black/60 backdrop-blur-xl border-l border-white/10 flex flex-col shadow-2xl transition-transform duration-300
                            md:relative md:w-64 md:translate-x-0 md:shadow-none
                            ${showControls ? 'translate-x-0' : 'translate-x-full md:hidden'}
                            `}>
                                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                                    <h3 className="text-xs font-bold text-[#29B6F6] uppercase flex items-center gap-2">
                                        <Settings className="h-3 w-3" /> Control de Modelo
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-gray-500 md:hidden"
                                        onClick={() => setShowControls(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">

                                    {/* RX Mode Toggle */}
                                    <div className="bg-[#0B0F14] border border-white/10 rounded-xl p-3 flex items-center gap-3 relative overflow-hidden group hover:border-[#29B6F6]/50 transition-colors">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#29B6F6]" />
                                        <div className="h-10 w-10 rounded-full bg-[#29B6F6]/10 flex items-center justify-center text-[#29B6F6] shrink-0">
                                            <Eye className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 flex items-center justify-between">
                                            <label className="text-sm text-white font-medium">Efecto RX (Wireframe)</label>
                                            <Switch checked={isRxMode} onCheckedChange={setIsRxMode} />
                                        </div>
                                    </div>

                                    {/* COLOR CARD */}
                                    <div className="bg-[#0B0F14] border border-white/10 rounded-xl p-3 flex items-center gap-3 relative overflow-hidden group hover:border-[#F59E0B]/50 transition-colors">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#F59E0B]" />
                                        <div className="h-10 w-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B] shrink-0">
                                            <div className="w-5 h-5 rounded-full border-2 border-current" style={{ backgroundColor: color }}></div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Color Base</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={color}
                                                    onChange={(e) => updateMaterialColor(e.target.value)}
                                                    className="w-full h-6 bg-transparent border-none cursor-pointer p-0"
                                                />
                                                <span className="text-xs font-mono text-gray-300">{color}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* TEXTURE CARD */}
                                    <div className="bg-[#0B0F14] border border-white/10 rounded-xl p-3 flex items-center gap-3 relative overflow-hidden group hover:border-[#29B6F6]/50 transition-colors">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#29B6F6]" />
                                        <div className="h-10 w-10 rounded-full bg-[#29B6F6]/10 flex items-center justify-center text-[#29B6F6] shrink-0">
                                            <ImageIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Textura</label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputTextureRef.current?.click()}
                                                className="w-full h-7 text-xs border-[#29B6F6]/30 text-[#29B6F6] hover:bg-[#29B6F6] hover:text-black"
                                            >
                                                Cargar Imagen
                                            </Button>
                                        </div>
                                    </div>

                                    {/* RESTORE BUTTON */}
                                    <Button
                                        variant="ghost"
                                        onClick={restoreOriginalParams}
                                        className="w-full border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-gray-400 text-xs h-8"
                                    >
                                        <RotateCw className="mr-2 h-3 w-3" /> Restaurar Original
                                    </Button>

                                    <div className="h-px bg-white/10 my-2" />

                                    {/* POSITION Y */}
                                    <div className="bg-[#0B0F14] border border-white/10 rounded-xl p-3 relative overflow-hidden group hover:border-[#10B981]/50 transition-colors">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#10B981]" />
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="h-8 w-8 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] shrink-0">
                                                <BoxIcon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Posición Y</label>
                                                <span className="text-sm font-mono text-white">{verticalPos.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <Slider
                                            value={[verticalPos]}
                                            min={-2}
                                            max={2}
                                            step={0.1}
                                            onValueChange={updateVerticalPosition}
                                            className="py-2"
                                        />
                                    </div>

                                    {/* ROTATION */}
                                    <div className="bg-[#0B0F14] border border-white/10 rounded-xl p-3 relative overflow-hidden group hover:border-[#8B5CF6]/50 transition-colors">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#8B5CF6]" />
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="h-8 w-8 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center text-[#8B5CF6] shrink-0">
                                                <RotateCw className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Rotación</label>
                                                <span className="text-sm font-mono text-white">{rotation.toFixed(0)}°</span>
                                            </div>
                                        </div>
                                        <Slider
                                            value={[rotation]}
                                            min={0}
                                            max={360}
                                            step={1}
                                            onValueChange={(v) => handleRotationChange(v[0])}
                                            className="py-2"
                                        />
                                    </div>

                                    {/* ROTATION CONTROLS (NEW) */}
                                    <div className="space-y-4 pt-4 border-t border-white/10">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs text-white font-medium">Animación (Giro)</label>
                                            <div
                                                onClick={() => setIsAutoRotate(!isAutoRotate)}
                                                className={`w - 10 h - 5 rounded - full flex items - center p - 1 cursor - pointer transition - colors ${isAutoRotate ? 'bg-green-500' : 'bg-gray-700'} `}
                                            >
                                                <div className={`h - 3 w - 3 rounded - full bg - white shadow - sm transform transition - transform ${isAutoRotate ? 'translate-x-5' : 'translate-x-0'} `} />
                                            </div>
                                        </div>

                                        {isAutoRotate && (
                                            <div className="flex gap-2">
                                                {['x', 'y', 'z'].map(axis => (
                                                    <Button
                                                        key={axis}
                                                        size="sm"
                                                        variant={rotationAxis === axis ? "secondary" : "ghost"}
                                                        onClick={() => setRotationAxis(axis)}
                                                        className={`flex - 1 text - xs h - 7 ${rotationAxis === axis ? 'bg-[#29B6F6] text-black' : 'text-gray-400 border border-white/10'} `}
                                                    >
                                                        Eje {axis.toUpperCase()}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-px bg-white/10" />

                                    {/* LIBRARY MOVED HERE */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs font-bold text-[#29B6F6] uppercase flex items-center gap-2">
                                                <Save className="h-3 w-3" /> Tu Librería
                                            </h3>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost" size="icon" className="h-5 w-5 text-gray-500"
                                                    onClick={() => loadAllData()} title="Recargar"
                                                >
                                                    <RotateCw className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Search */}
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-500" />
                                            <input
                                                type="text"
                                                placeholder="Buscar..."
                                                className="w-full bg-black/20 border border-white/10 rounded pl-7 pr-2 py-1 text-[10px] text-white focus:border-[#29B6F6] outline-none"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>

                                        {/* List */}
                                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                            {userModels
                                                .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                .map(m => (
                                                    <div
                                                        key={m.id}
                                                        onClick={() => handleLoadModel(m)}
                                                        className="group relative flex items-start gap-2 p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer border border-transparent hover:border-[#29B6F6]/30 transition-all"
                                                    >
                                                        <div className="w-10 h-10 bg-black/30 rounded border border-white/10 flex items-center justify-center shrink-0 overflow-hidden relative">
                                                            {m.file_url ? (
                                                                <img
                                                                    src={m.file_url.replace(/\.(glb|gltf|fbx|obj|tm|skp)$/i, '.png')}
                                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : <BoxIcon className="h-4 w-4 text-gray-600" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] text-white font-medium truncate" title={m.name}>{m.name}</p>
                                                            <p className="text-[9px] text-gray-500 truncate">{new Date(m.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDeleteModel(e, m.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded transition-all"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                </div>
                            </aside>
                        </>
                    )}

                </div>

                {/* BOTTOM TOOLBAR (MOBILE ONLY) */}
                <div className="md:hidden bg-[#151B23] border-t border-white/10 p-2 flex justify-around items-center shrink-0 z-50 pb-safe">
                    {/* Upload */}
                    <div className="flex flex-col items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full bg-white/5 text-[#29B6F6]"
                            onClick={() => {
                                if (activeTab === 'image') fileInputRef.current?.click();
                                else setShowUploadDialog(true);
                            }}
                        >
                            <Upload className="h-5 w-5" />
                        </Button>
                        <span className="text-[9px] text-gray-400">Subir</span>
                    </div>

                    {/* Center */}
                    {activeTab === '3d' && (
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full bg-white/5 text-white"
                                onClick={handleCenterView}
                                disabled={!modelObject}
                            >
                                <ZoomIn className="h-5 w-5" />
                            </Button>
                            <span className="text-[9px] text-gray-400">Centrar</span>
                        </div>
                    )}

                    {/* AR - MAIN ACTION */}
                    {activeTab === '3d' && (
                        <div className="flex flex-col items-center gap-1 -mt-6">
                            <Button
                                className="h-14 w-14 rounded-full bg-[#29B6F6] hover:bg-[#29B6F6] text-[#0B0F14] shadow-lg shadow-[#29B6F6]/20 border-4 border-[#0B0F14]"
                                onClick={handleOpenAR}
                                disabled={!modelObject || loading}
                            >
                                <Camera className="h-7 w-7" />
                            </Button>
                            <span className="text-[10px] font-bold text-[#29B6F6]">AR</span>
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h - 10 w - 10 rounded - full bg - white / 5 ${showControls ? 'text-[#29B6F6] bg-[#29B6F6]/10' : 'text-white'} `}
                            onClick={() => setShowControls(!showControls)}
                        >
                            <Settings className="h-5 w-5" />
                        </Button>
                        <span className="text-[9px] text-gray-400">Ajustes</span>
                    </div>
                    {/* Library Toggle */}
                    {activeTab === '3d' && (
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`h - 10 w - 10 rounded - full bg - white / 5 ${showMobileLibrary ? 'text-[#29B6F6]' : 'text-white'} `}
                                onClick={() => {
                                    setShowMobileLibrary(true);
                                    loadAllData(); // Refresh on open
                                }}
                            >
                                <BookOpen className="h-5 w-5" />
                            </Button>
                            <span className="text-[9px] text-gray-400">Librería</span>
                        </div>
                    )}


                    {/* Save/Download */}
                    <div className="flex flex-col items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full bg-white/5 text-green-400"
                            onClick={() => {
                                if (activeTab === 'image') handleImageDownload();
                                else setShowSaveDialog(true);
                            }}
                            disabled={(!image && !modelObject) || loading}
                        >
                            <Save className="h-5 w-5" />
                        </Button>
                        <span className="text-[9px] text-gray-400">Guardar</span>
                    </div>
                </div>
            </div >

            {/* NEW UPLOAD DIALOG */}
            < Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog} >
                <DialogContent className="bg-[#151B23] border-[#29B6F6]/20 text-white sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-[#29B6F6]">Subir Archivos 3D</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Sube un archivo ZIP con tu modelo y texturas, o arrastra todo tu folder aquí.
                        </DialogDescription>
                    </DialogHeader>

                    <div
                        className="border-2 border-dashed border-[#29B6F6]/40 rounded-xl p-10 flex flex-col items-center justify-center bg-[#0B0F14] hover:bg-[#29B6F6]/5 transition-colors cursor-pointer"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            setShowUploadDialog(false);
                            handleDrop(e);
                        }}
                        onClick={() => {
                            setShowUploadDialog(false);
                            fileInput3DRef.current?.click();
                        }}
                    >
                        <Upload className="h-16 w-16 text-[#29B6F6] mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Arrastra tu ZIP o Archivos aquí</h3>
                        <p className="text-sm text-gray-500 mb-6 text-center">
                            Soporta: .DAE, .OBJ, .FBX, .GLB<br />
                            (Incluye tus texturas imagenes en el mismo ZIP)
                        </p>
                        <Button variant="outline" className="border-[#29B6F6] text-[#29B6F6] hover:bg-[#29B6F6] hover:text-black">
                            Seleccionar Archivos
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* SAVE TO PROJECT DIALOG */}
            < Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog} >
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
                            disabled={!saveData.name || loading}
                            className="bg-[#29B6F6] text-[#0B0F14] hover:bg-[#29B6F6]/90"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
            {/* AR PREVIEW DIALOG */}
            < Dialog open={showAR} onOpenChange={setShowAR} >
                <DialogContent className="bg-[#151B23] border-[#29B6F6]/20 text-white w-screen h-screen max-w-none m-0 rounded-none flex flex-col p-0">
                    <DialogHeader className="p-4 bg-[#0B0F14] shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-white">
                            <Camera className="h-5 w-5 text-[#29B6F6]" />
                            Previsualización AR
                        </DialogTitle>
                        <DialogDescription className="text-gray-400 text-xs">
                            Apunta tu cámara a una superficie plana.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 bg-black/50 overflow-hidden relative">
                        {arBlobUrl && (
                            <model-viewer
                                src={arBlobUrl}
                                ar
                                ar-modes="webxr scene-viewer quick-look"
                                camera-controls
                                auto-rotate
                                shadow-intensity="1"
                                ar-scale="auto"
                                ar-placement="floor"
                                ios-src={iosSrc}
                                quick-look-browsers="safari chrome"
                                style={{ width: '100%', height: '100%' }}
                            >
                                <Button
                                    slot="ar-button"
                                    className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#29B6F6] text-black hover:bg-[#29B6F6]/90 shadow-xl rounded-full px-8 py-6 text-lg font-bold animate-pulse z-50 pointer-events-auto"
                                >
                                    <Camera className="h-6 w-6 mr-2" />
                                    {isGeneratingAR ? "Procesando iOS..." : "Activar Cámara"}
                                </Button>
                            </model-viewer>
                        )}
                    </div>

                    <div className="p-4 bg-[#0B0F14] shrink-0 flex flex-col gap-2">
                        <div className="text-[10px] text-gray-500 text-center w-full">
                            * Requiere Android (Chrome) o iOS (Safari) compatible con AR.
                        </div>
                        <Button onClick={() => setShowAR(false)} variant="secondary" className="w-full">Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog >

            {/* MOBILE LIBRARY OVERLAY */}
            < MobileLibraryOverlay
                open={showMobileLibrary}
                onClose={() => setShowMobileLibrary(false)
                }
                models={userModels}
                onLoadModel={handleLoadModel}
                onDeleteModel={handleDeleteModel}
                loading={loading}
                onRefresh={loadAllData}
            />
        </>
    );
}

// Mobile Library Overlay Component
function MobileLibraryOverlay({ open, onClose, models, onLoadModel, onDeleteModel, loading, onRefresh }) {
    if (!open) return null;

    // Auto-refresh when opened
    useEffect(() => {
        if (open && onRefresh) {
            onRefresh();
        }
    }, [open]);

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-[#29B6F6]" />
                    Tu Librería
                </h3>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRefresh}
                        className="rounded-full h-8 w-8 bg-white/10 text-white active:bg-[#29B6F6] active:text-black"
                        title="Actualizar"
                    >
                        <RotateCw className={`h - 4 w - 4 ${loading ? 'animate-spin' : ''} `} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 bg-white/10 text-white">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {models.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-60">
                        <BoxIcon className="h-12 w-12 mb-2" />
                        <p className="mb-4">No se encontraron modelos</p>
                        <Button onClick={onRefresh} variant="outline" className="border-white/20 text-white">
                            <RotateCw className="mr-2 h-4 w-4" /> Forzar Recarga
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {models.map(m => (
                            <div
                                key={m.id}
                                onClick={() => {
                                    onLoadModel(m);
                                    onClose();
                                }}
                                className="bg-white/5 rounded-lg overflow-hidden border border-white/10 active:scale-95 transition-transform"
                            >
                                <div className="aspect-square bg-black/20 relative">
                                    {m.file_url ? (
                                        <img
                                            src={m.file_url.replace(/\.(glb|gltf|fbx|obj|tm|skp)$/i, '.png')}
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    ) : <div className="w-full h-full flex items-center justify-center"><BoxIcon className="text-gray-600" /></div>}

                                    <div className="absolute top-1 right-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteModel(e, m.id); }}
                                            className="p-1.5 bg-red-500/80 text-white rounded-full shadow-sm"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-2">
                                    <p className="text-xs font-bold text-white truncate">{m.name}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(m.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-white/10 bg-black/40 shrink-0">
                <Button onClick={onClose} className="w-full bg-[#29B6F6] text-black font-bold">
                    Cerrar Librería
                </Button>
            </div>
        </div>
    );
}

export default Converter;
