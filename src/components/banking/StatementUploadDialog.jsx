import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { supabase } from '../../api/supabaseClient';

export function StatementUploadDialog({ open, onOpenChange, onUploadSuccess, profileId }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      const validTypes = [
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'text/plain',
        'application/x-ofx',
        'application/vnd.intu.qfx',
        'application/octet-stream'
      ];

      if (!validTypes.includes(selectedFile.type) &&
          !selectedFile.name.match(/\.(pdf|csv|ofx|qfx)$/i)) {
        setError('Only PDF, CSV, OFX, and QFX files are supported');
        return;
      }

      setFile(selectedFile);
      setError('');
      setSuccess(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setFile(droppedFile);
      setError('');
      setSuccess(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!file || !profileId) return;

    setUploading(true);
    setError('');
    setProcessingStage('Uploading file...');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const filePath = `${user.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('statement-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: uploadRecord, error: recordError } = await supabase
        .from('statement_uploads')
        .insert({
          user_id: user.id,
          profile_id: profileId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          processing_status: 'processing'
        })
        .select()
        .single();

      if (recordError) throw recordError;

      setProcessingStage('Analyzing with AI...');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result.split(',')[1];

          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          console.log('Sending to parse-pdf:', {
            file_name: file.name,
            profile_id: profileId,
            data_length: base64Data?.length,
            has_token: !!token
          });

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-pdf`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                file_data: base64Data,
                file_name: file.name,
                profile_id: profileId
              })
            }
          );

          const result = await response.json();
          console.log('Parse response:', result);

          if (!response.ok || result.status === 'error') {
            console.error('Parse error details:', result);
            throw new Error(result.error || result.details || 'Failed to parse file');
          }

          setProcessingStage('Extraction complete!');

          await supabase
            .from('statement_uploads')
            .update({
              processing_status: 'completed',
              transactions_count: result.output.transactions?.length || 0,
              suggested_account_id: result.output.suggestedAccountId
            })
            .eq('id', uploadRecord.id);

          await supabase.storage
            .from('statement-files')
            .remove([filePath]);

          setSuccess(true);
          setUploading(false);

          setTimeout(() => {
            onUploadSuccess(result.output);
            handleClose();
          }, 1000);

        } catch (parseError) {
          console.error('Parse error:', parseError);
          setError(parseError.message || 'Failed to parse file');
          setUploading(false);

          await supabase
            .from('statement_uploads')
            .update({
              processing_status: 'failed',
              error_message: parseError.message
            })
            .eq('id', uploadRecord.id);

          await supabase.storage
            .from('statement-files')
            .remove([filePath]);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };

      reader.readAsDataURL(file);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setError('');
      setSuccess(false);
      setProcessingStage('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Bank Statement</DialogTitle>
          <DialogDescription>
            Upload a PDF, CSV, OFX, or QFX bank statement to automatically import transactions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!file && !uploading && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Click to browse or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                PDF, CSV, OFX, or QFX (Max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.ofx,.qfx,application/pdf,text/csv,application/x-ofx,application/vnd.intu.qfx"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {file && !uploading && !success && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="w-10 h-10 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {!uploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  Remove
                </Button>
              )}
            </div>
          )}

          {uploading && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {processingStage}
                  </p>
                  <p className="text-xs text-gray-500">
                    This may take a few moments...
                  </p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Statement processed successfully! Preparing import preview...
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {file && file.size > 5 * 1024 * 1024 && !uploading && !error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Large file detected. Processing may take 1-2 minutes.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Upload & Process'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
