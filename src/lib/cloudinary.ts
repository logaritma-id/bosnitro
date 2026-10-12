export async function uploadSnapshot(dataUrl: string): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  
  if (!cloudName || !uploadPreset) {
    console.warn("Cloudinary belum dikonfigurasi. Menggunakan mock URL.");
    return "https://res.cloudinary.com/demo/image/upload/sample.jpg";
  }

  const formData = new FormData();
  formData.append('file', dataUrl);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error("Gagal mengupload gambar");
    }
    
    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Upload error:", error);
    return "";
  }
}
