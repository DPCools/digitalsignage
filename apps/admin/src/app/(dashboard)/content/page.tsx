'use client';
import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { Upload, Loader2 } from 'lucide-react';

export default function ContentPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const { data, refetch } = trpc.content.list.useQuery({});
  const getUploadUrl = trpc.content.getUploadUrl.useMutation();
  const confirmUpload = trpc.content.confirmUpload.useMutation({ onSuccess: () => refetch() });

  async function handleFile(file: File) {
    setError('');
    setUploading(true);
    try {
      const { url, key } = await getUploadUrl.mutateAsync({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await confirmUpload.mutateAsync({ name: file.name, key, mimeType: file.type, fileSize: file.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Content Library</h1>
        <label className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 cursor-pointer">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Upload'}
          <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.html"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {data?.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="aspect-video bg-gray-800 flex items-center justify-center">
              {item.type === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-500 uppercase">{item.type}</span>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs text-white truncate">{item.name}</p>
              <p className="text-xs text-gray-500 capitalize">{item.type.toLowerCase().replace('_', ' ')}</p>
            </div>
          </div>
        ))}
        {data?.items.length === 0 && (
          <p className="col-span-full text-center text-gray-500 py-12">No content yet. Upload some files to get started.</p>
        )}
      </div>
    </div>
  );
}
