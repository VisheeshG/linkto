"use client";

import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Brand } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { generateUniqueProjectSlug } from "@/lib/generators";
import toast from "react-hot-toast";

interface NewProjectFormProps {
  brands: Brand[];
  defaultBrandId?: string | null;
  onSubmit: (
    name: string,
    description: string,
    slug: string,
    brandId: string | null
  ) => Promise<boolean>;
  onCancel: () => void;
}

export function NewProjectForm({
  brands,
  defaultBrandId = null,
  onSubmit,
  onCancel,
}: NewProjectFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [brandId, setBrandId] = useState<string>(defaultBrandId ?? "");
  const [slugMode, setSlugMode] = useState<"auto" | "custom">("auto");
  const [isGeneratingSlug, setIsGeneratingSlug] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setBrandId(defaultBrandId ?? "");
  }, [defaultBrandId]);

  const handleGenerateSlug = async () => {
    setIsGeneratingSlug(true);
    try {
      const randomSlug = await generateUniqueProjectSlug(supabase);
      setSlug(randomSlug);
    } catch (error) {
      console.error("Error generating slug:", error);
    } finally {
      setIsGeneratingSlug(false);
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);

    if (slugMode !== "auto") return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (value.trim()) {
      debounceTimeoutRef.current = setTimeout(async () => {
        try {
          const autoSlug = await generateUniqueProjectSlug(supabase);
          setSlug(autoSlug);
        } catch (error) {
          console.error("Error auto-generating slug:", error);
        }
      }, 500);
    }
  };

  const handleSlugModeChange = (mode: "auto" | "custom") => {
    setSlugMode(mode);
    if (mode === "custom") {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      setSlug("");
    } else {
      handleGenerateSlug();
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!slug.trim()) {
      toast.error(
        slugMode === "auto"
          ? "Please wait for the project slug to be generated before submitting."
          : "Please enter a custom project slug."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(
        name,
        description,
        slug,
        brandId.trim() ? brandId : null
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-2xl border border-slate-200/60 p-4 sm:p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            Create New Project
          </h3>
          <p className="text-xs text-slate-600">
            Set up a new tracking campaign
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-bold text-slate-700 mb-1.5"
          >
            Project Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="e.g., Website Campaign, App Launch"
            required
          />
        </div>

        <div>
          <label
            htmlFor="brand"
            className="block text-sm font-bold text-slate-700 mb-1.5"
          >
            Brand
          </label>
          <select
            id="brand"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
          >
            <option value="">Unbranded</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-bold text-slate-700 mb-1.5">
            Project Slug
          </span>
          <div className="flex rounded-xl border-2 border-slate-300 p-0.5 mb-2">
            <button
              type="button"
              onClick={() => handleSlugModeChange("auto")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                slugMode === "auto"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Auto-generate
            </button>
            <button
              type="button"
              onClick={() => handleSlugModeChange("custom")}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                slugMode === "custom"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Custom
            </button>
          </div>
          <div className="flex gap-2">
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={
                slugMode === "custom"
                  ? (e) => setSlug(e.target.value)
                  : undefined
              }
              readOnly={slugMode === "auto"}
              className={`flex-1 min-w-0 px-3 py-3 text-base border-2 border-slate-300 rounded-xl font-mono outline-none transition-all ${
                slugMode === "auto"
                  ? "bg-slate-50 text-slate-600 cursor-not-allowed"
                  : "focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              }`}
              placeholder={
                slugMode === "auto"
                  ? "Auto-generated letter"
                  : "e.g., my-campaign, launch2026"
              }
              required
            />
            {slugMode === "auto" && (
              <button
                type="button"
                onClick={handleGenerateSlug}
                disabled={isGeneratingSlug}
                className="shrink-0 px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
              >
                {isGeneratingSlug ? "..." : "New"}
              </button>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-bold text-slate-700 mb-1.5"
          >
            Description{" "}
            <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-3 text-base border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all"
            rows={2}
            placeholder="Brief description of this project"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-2 text-sm rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating..." : "Create Project"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 text-sm rounded-xl transition-all font-semibold disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
