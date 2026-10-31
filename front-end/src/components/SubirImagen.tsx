import { Crop, ImageUpIcon, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { MAX_BYTES_IMAGEN, TIPOS_IMAGEN } from "../lib/api";
import EditorImagen from "./EditorImagen";

interface Props {
  imagenInicial?: string | null;
  onChange?: (archivo: File | null) => void;
  onEliminar?: () => void;
  className?: string;
  fondoOscuro?: boolean; // para imágenes claras, como el logo
  proporcion?: number; // proporción sugerida para el recorte (ancho / alto)
}

/* Zona para elegir o arrastrar una imagen. Solo muestra la vista previa y entrega el
   archivo con onChange; quien la usa lo sube al guardar (ver subirImagen en lib/api). */
export default function SubirImagen({
  imagenInicial,
  onChange,
  onEliminar,
  className = "h-48",
  fondoOscuro = false,
  proporcion,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // `local`: vista previa de un archivo elegido (blob:). `quitada`: se quitó la imagen guardada.
  const [local, setLocal] = useState<string | null>(null);
  const [quitada, setQuitada] = useState(false);
  const [inicial, setInicial] = useState(imagenInicial);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si llega otra imagen guardada (p. ej. después de guardar), se vuelve a mostrar esa
  if (inicial !== imagenInicial) {
    setInicial(imagenInicial);
    setLocal(null);
    setQuitada(false);
  }
  const vista = local ?? (quitada ? null : (imagenInicial ?? null));
  const setVista = (url: string | null) => {
    setLocal(url);
    setQuitada(url === null);
  };

  // Libera la vista previa local (blob:) cuando cambia o se desmonta
  useEffect(() => {
    return () => {
      if (local) URL.revokeObjectURL(local);
    };
  }, [local]);

  // Archivo que se está encuadrando en el editor (recorte) y el último que se aceptó (para volver a editarlo)
  const [pendiente, setPendiente] = useState<File | null>(null);
  const [ultimo, setUltimo] = useState<File | null>(null);

  const aceptar = (imagen: File) => {
    if (imagen.size > MAX_BYTES_IMAGEN) {
      setError("La imagen pesa más de 5 MB.");
      return;
    }
    setError(null);
    setUltimo(imagen);
    setVista(URL.createObjectURL(imagen));
    onChange?.(imagen);
  };

  // Al elegir una foto se abre el editor para encuadrarla antes de aceptarla
  const manejarImagen = (imagen: File) => {
    if (!TIPOS_IMAGEN.includes(imagen.type)) {
      setError("Formato no permitido. Usa JPG, PNG, WEBP, GIF o AVIF.");
      return;
    }
    setError(null);
    setPendiente(imagen);
  };

  const limpiar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVista(null);
    setUltimo(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onEliminar?.();
    onChange?.(null);
  };

  const manejarUrl = async (url: string) => {
    try {
      const respuesta = await fetch(url);
      const blob = await respuesta.blob();
      const extension = blob.type.split("/")[1] ?? "jpg";
      manejarImagen(new File([blob], `imagen.${extension}`, { type: blob.type }));
    } catch {
      setError("No se pudo cargar esa imagen (el sitio no lo permite). Descárgala y súbela.");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="button"
        tabIndex={0}
        aria-label={vista ? "Cambiar imagen" : "Subir imagen"}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => {
          setArrastrando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          const archivo = e.dataTransfer.files[0];
          if (archivo) {
            manejarImagen(archivo);
            return;
          }
          const url = e.dataTransfer.getData("text/uri-list");
          if (url) manejarUrl(url);
        }}
        className={`relative flex items-center justify-center rounded-2xl border-2 border-dashed border-rosa-vino transition-colors ${
          arrastrando
            ? "border-tinto bg-chip"
            : fondoOscuro
              ? "bg-tinto-oscuro hover:bg-tinto"
              : "bg-white hover:bg-beige"
        } ${className}`}
      >
        <input
          type="file"
          accept={TIPOS_IMAGEN.join(",")}
          className="hidden"
          ref={inputRef}
          onChange={(e) => {
            const imagen = e.target.files?.[0];
            if (imagen) manejarImagen(imagen);
          }}
        />

        {vista ? (
          <>
            <img
              src={vista}
              alt="Vista previa de la imagen"
              className="h-full w-full rounded-2xl object-contain p-1"
            />
            {ultimo && (
              <button
                type="button"
                aria-label="Recortar o ajustar imagen"
                title="Recortar / ajustar"
                className="absolute top-1.5 right-9 rounded-full bg-white p-1 text-tinto shadow hover:text-dorado"
                onClick={(e) => { e.stopPropagation(); setPendiente(ultimo); }}
              >
                <Crop size={16} />
              </button>
            )}
            <button
              type="button"
              aria-label="Quitar imagen"
              className="absolute top-1.5 right-1.5 rounded-full bg-white p-1 text-tinto shadow hover:text-error"
              onClick={limpiar}
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className={`flex flex-col items-center justify-center p-5 text-center ${fondoOscuro && !arrastrando ? "text-beige" : "text-tinto"}`}>
            <ImageUpIcon size={44} className="mb-2" />
            <span className="w-52 font-texto text-sm font-normal">
              Arrastra una imagen o haz clic para seleccionar una
            </span>
          </div>
        )}
      </div>
      {pendiente && (
        <EditorImagen
          archivo={pendiente}
          proporcion={proporcion}
          onListo={(f) => { setPendiente(null); aceptar(f); }}
          onSinRecortar={() => { const f = pendiente; setPendiente(null); aceptar(f); }}
          onCancelar={() => { setPendiente(null); if (inputRef.current) inputRef.current.value = ""; }}
        />
      )}
      {error && (
        <p className="font-ui text-xs font-semibold text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
