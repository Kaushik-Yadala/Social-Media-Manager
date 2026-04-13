'use client';

import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Facebook,
    FileArchive,
    FileSpreadsheet,
    Instagram,
    Loader2,
    UploadCloud,
    X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
    getManualUploadPath,
    ManualPlatform,
    ManualUploadMode,
    ManualUploadResult,
    uploadManualInsights,
} from '@/lib/api/manual-insights-api';

type PlatformTheme = {
    title: string;
    accountParam: 'ig_user_id' | 'fb_user_id';
    accountLabel: string;
    Icon: typeof Instagram;
    panelBorder: string;
    panelHeaderBg: string;
    accentText: string;
    badgeClass: string;
    endpointClass: string;
    submitClass: string;
    infoClass: string;
    dropzoneClass: string;
    dropzoneActiveClass: string;
};

const PLATFORM_THEMES: Record<ManualPlatform, PlatformTheme> = {
    insta: {
        title: 'Instagram',
        accountParam: 'ig_user_id',
        accountLabel: 'Instagram User ID',
        Icon: Instagram,
        panelBorder: 'border-violet-200',
        panelHeaderBg: 'bg-gradient-to-r from-violet-50 via-fuchsia-50 to-indigo-50',
        accentText: 'text-violet-700',
        badgeClass: 'border-violet-200 bg-violet-100 text-violet-700',
        endpointClass: 'border-violet-200 bg-violet-50 text-violet-800',
        submitClass: 'bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-300',
        infoClass: 'text-violet-700',
        dropzoneClass: 'border-violet-200 bg-violet-50/70',
        dropzoneActiveClass: 'border-violet-400 bg-violet-100/70',
    },
    facebook: {
        title: 'Facebook',
        accountParam: 'fb_user_id',
        accountLabel: 'Facebook User ID',
        Icon: Facebook,
        panelBorder: 'border-blue-200',
        panelHeaderBg: 'bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50',
        accentText: 'text-blue-700',
        badgeClass: 'border-blue-200 bg-blue-100 text-blue-700',
        endpointClass: 'border-blue-200 bg-blue-50 text-blue-800',
        submitClass: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-300',
        infoClass: 'text-blue-700',
        dropzoneClass: 'border-blue-200 bg-blue-50/70',
        dropzoneActiveClass: 'border-blue-400 bg-blue-100/70',
    },
};

const DEFAULT_ACCOUNT_ID = 'ClubArtizen';

function isCsvFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.csv');
}

function isZipFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.zip');
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ManualUploadPage() {
    const [platform, setPlatform] = useState<ManualPlatform>('insta');
    const [uploadMode, setUploadMode] = useState<ManualUploadMode>('csv');
    const [accountId, setAccountId] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [success, setSuccess] = useState<ManualUploadResult | null>(null);
    const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const theme = PLATFORM_THEMES[platform];

    const endpointResolved = useMemo(() => {
        const normalizedId = accountId.trim() || DEFAULT_ACCOUNT_ID;
        return getManualUploadPath(platform, uploadMode, normalizedId);
    }, [accountId, platform, uploadMode]);

    const selectedFileLabel = uploadMode === 'csv' ? 'CSV file(s)' : 'ZIP archive';
    const accept = uploadMode === 'csv' ? '.csv,text/csv' : '.zip,application/zip';

    const clearNativeFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const resetSelectedFiles = () => {
        setFiles([]);
        clearNativeFileInput();
    };

    const handlePlatformChange = (nextPlatform: ManualPlatform) => {
        setPlatform(nextPlatform);
        resetSelectedFiles();
        setErrorMessage(null);
        setSuccess(null);
    };

    const handleUploadModeChange = (nextMode: ManualUploadMode) => {
        setUploadMode(nextMode);
        resetSelectedFiles();
        setErrorMessage(null);
        setSuccess(null);
    };

    const handleSelectedFiles = (selected: File[]) => {
        if (selected.length === 0) {
            setFiles([]);
            return;
        }

        if (uploadMode === 'csv') {
            const invalidCsv = selected.filter((file) => !isCsvFile(file));
            if (invalidCsv.length > 0) {
                setErrorMessage('CSV mode only accepts .csv files.');
                setFiles([]);
                clearNativeFileInput();
                return;
            }
            setFiles(selected);
            setErrorMessage(null);
            setSuccess(null);
            return;
        }

        if (selected.length !== 1 || !isZipFile(selected[0])) {
            setErrorMessage('ZIP mode requires exactly one .zip file.');
            setFiles([]);
            clearNativeFileInput();
            return;
        }

        setFiles([selected[0]]);
        setErrorMessage(null);
        setSuccess(null);
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(event.target.files ?? []);
        handleSelectedFiles(selected);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const selected = Array.from(event.dataTransfer.files ?? []);
        handleSelectedFiles(selected);
    };

    const removeFile = (indexToRemove: number) => {
        setFiles((previousFiles) => previousFiles.filter((_, index) => index !== indexToRemove));
        setSuccess(null);
        clearNativeFileInput();
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);
        setSuccess(null);

        const normalizedAccountId = accountId.trim() || DEFAULT_ACCOUNT_ID;

        if (files.length === 0) {
            setErrorMessage(`Please select ${selectedFileLabel.toLowerCase()} before uploading.`);
            return;
        }

        if (uploadMode === 'zip' && files.length !== 1) {
            setErrorMessage('ZIP mode requires exactly one file.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = await uploadManualInsights({
                platform,
                mode: uploadMode,
                accountId: normalizedAccountId,
                files,
            });
            setSuccess(payload);
            setLastCompletedAt(new Date().toLocaleString());
            resetSelectedFiles();
        } catch (error) {
            setErrorMessage((error as Error).message || 'Upload failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-10">
            <div>
                <h1 className="text-2xl font-heading font-bold text-stone-900">Manual Data Upload</h1>
                <p className="mt-1 text-sm text-stone-500">
                    Upload CSVs or ZIP archives to update Instagram/Facebook insights in the database.
                </p>
            </div>

            <Card className={cn('overflow-hidden border', theme.panelBorder)}>
                <CardHeader className={cn('gap-3 border-b border-stone-200/70', theme.panelHeaderBg)}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <theme.Icon className={cn('h-5 w-5', theme.accentText)} />
                            <CardTitle className="text-base text-stone-900">Upload Configuration</CardTitle>
                        </div>
                        <Badge variant="outline" className={theme.badgeClass}>
                            {theme.title}
                        </Badge>
                    </div>
                    <CardDescription className="text-stone-600">
                        Choose platform, file type, and account ID. Then drag files into the upload zone.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 pt-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label>Platform</Label>
                            <Tabs
                                value={platform}
                                onValueChange={(value) => handlePlatformChange(value as ManualPlatform)}
                                className="w-full"
                            >
                                <TabsList className="grid h-auto w-full grid-cols-2 bg-stone-100 p-1">
                                    <TabsTrigger
                                        value="insta"
                                        className="flex items-center gap-2 py-2 data-[state=active]:bg-violet-100 data-[state=active]:text-violet-700"
                                    >
                                        <Instagram className="h-4 w-4" />
                                        Instagram
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="facebook"
                                        className="flex items-center gap-2 py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                                    >
                                        <Facebook className="h-4 w-4" />
                                        Facebook
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Upload Type</Label>
                                <Select
                                    value={uploadMode}
                                    onValueChange={(value) => handleUploadModeChange(value as ManualUploadMode)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Choose upload type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="csv">CSV files</SelectItem>
                                        <SelectItem value="zip">ZIP folder archive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="manual-account-id">{theme.accountLabel}</Label>
                                <Input
                                    id="manual-account-id"
                                    value={accountId}
                                    onChange={(event) => setAccountId(event.target.value)}
                                    placeholder={`${theme.accountParam === 'ig_user_id' ? 'test_user' : 'test_page'} (defaults to ${DEFAULT_ACCOUNT_ID})`}
                                    autoComplete="off"
                                />
                                <p className={cn('text-xs', theme.infoClass)}>
                                    Leave blank to use default ID: <span className="font-semibold">{DEFAULT_ACCOUNT_ID}</span>
                                </p>
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            id="manual-upload-file"
                            type="file"
                            accept={accept}
                            multiple={uploadMode === 'csv'}
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <div className="space-y-2">
                            <Label>{selectedFileLabel}</Label>
                            <div
                                role="button"
                                tabIndex={0}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        fileInputRef.current?.click();
                                    }
                                }}
                                className={cn(
                                    'relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
                                    theme.dropzoneClass,
                                    isDragging && theme.dropzoneActiveClass,
                                )}
                            >
                                <div className={cn('rounded-full p-4', theme.endpointClass)}>
                                    {uploadMode === 'csv' ? (
                                        <FileSpreadsheet className="h-8 w-8" />
                                    ) : (
                                        <FileArchive className="h-8 w-8" />
                                    )}
                                </div>
                                <p className="mt-4 text-lg font-semibold text-stone-900">
                                    Drag and drop {uploadMode === 'csv' ? 'CSV files' : 'a ZIP archive'} here
                                </p>
                                <p className="mt-1 text-sm text-stone-500">
                                    or click to browse from your computer
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="mt-5"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        fileInputRef.current?.click();
                                    }}
                                >
                                    <UploadCloud className="h-4 w-4" />
                                    Choose file{uploadMode === 'csv' ? 's' : ''}
                                </Button>
                                <p className={cn('mt-4 text-xs', theme.infoClass)}>
                                    {uploadMode === 'csv'
                                        ? 'Supports one or more .csv files'
                                        : 'Supports one .zip file containing CSV files'}
                                </p>
                            </div>
                        </div>

                        {files.length > 0 && (
                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                <p className="text-xs font-medium text-stone-700">Selected file(s):</p>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600">
                                    {files.map((file, index) => (
                                        <li
                                            key={`${file.name}-${file.lastModified}`}
                                            className="flex items-center justify-between gap-3 rounded-md bg-white px-2 py-1"
                                        >
                                            <span className="truncate">{file.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="shrink-0 text-stone-400">{formatFileSize(file.size)}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="text-stone-400 hover:text-red-600"
                                                    onClick={() => removeFile(index)}
                                                    aria-label={`Remove ${file.name}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className={cn('rounded-lg border px-3 py-2 text-xs font-mono', theme.endpointClass)}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">Endpoint</p>
                            <p className="mt-1 break-all">POST {endpointResolved}</p>
                        </div>

                        {errorMessage && (
                            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {success && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                    <div>
                                        <p className="text-sm font-medium text-emerald-800">Upload completed successfully.</p>
                                        <p className="text-xs text-emerald-700">{success.message}</p>
                                        {lastCompletedAt && (
                                            <p className="mt-1 text-[11px] text-emerald-700">Completed at: {lastCompletedAt}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-emerald-900 md:grid-cols-4">
                                    <div className="rounded-md bg-white/70 px-2 py-1">
                                        <span className="block text-[11px] text-emerald-700">Processed files</span>
                                        <span className="font-semibold">{success.processed_files ?? 0}</span>
                                    </div>
                                    <div className="rounded-md bg-white/70 px-2 py-1">
                                        <span className="block text-[11px] text-emerald-700">Touched dates</span>
                                        <span className="font-semibold">{success.touched_dates ?? 0}</span>
                                    </div>
                                    <div className="rounded-md bg-white/70 px-2 py-1">
                                        <span className="block text-[11px] text-emerald-700">Created rows</span>
                                        <span className="font-semibold">{success.created_entries ?? 0}</span>
                                    </div>
                                    <div className="rounded-md bg-white/70 px-2 py-1">
                                        <span className="block text-[11px] text-emerald-700">Updated rows</span>
                                        <span className="font-semibold">{success.updated_entries ?? 0}</span>
                                    </div>
                                </div>
                                {Array.isArray(success.metric_keys) && success.metric_keys.length > 0 && (
                                    <div className="mt-3">
                                        <p className="text-[11px] font-medium text-emerald-800">Imported metrics</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {success.metric_keys.map((metricKey) => (
                                                <Badge
                                                    key={metricKey}
                                                    variant="outline"
                                                    className="border-emerald-200 bg-white text-[10px] text-emerald-700"
                                                >
                                                    {metricKey}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {typeof success.archive_name === 'string' && success.archive_name.length > 0 && (
                                    <p className="mt-2 text-[11px] text-emerald-700">
                                        Archive: <span className="font-medium">{success.archive_name}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className={cn('text-white', theme.submitClass)}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="h-4 w-4" />
                                        Upload and Update Database
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    resetSelectedFiles();
                                    setErrorMessage(null);
                                    setSuccess(null);
                                }}
                                disabled={isSubmitting}
                            >
                                Clear Selection
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
