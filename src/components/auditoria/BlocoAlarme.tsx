import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertCircle, Info, Loader2, FileWarning, Camera } from "lucide-react";

export function BlocoAlarme({ auditoriaId }: { auditoriaId?: string }) {
  const [tags, setTags] = useState<any[]>([]);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    async function loadTags() {
      try {
        const { data, error } = await supabase
          .from("tags")
          .select("*")
          .eq("pilar", "CONDICAO")
          .like("codigo", "A-%")
          .eq("ativa", true)
          .order("codigo");

        if (error) {
          setErrorMsg(error.message);
        } else if (data) {
          setTags(data);
        }
      } catch (e: any) {
        setErrorMsg(e.message || "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    loadTags();
  }, []);

  const toggleTag = (id: string) => {
    setMarcadas((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground bg-background rounded-lg border border-border shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-3 text-sm font-medium">Carregando catálogo do Bloco D...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-red-50 text-red-700 border border-red-200 rounded-md">
        <p className="font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Erro ao carregar tags operacionais
        </p>
        <p className="text-sm mt-1">{errorMsg}</p>
      </div>
    );
  }

  return (
    <Card className="w-full bg-background shadow-sm border-border">
      <CardHeader className="bg-muted/30 border-b">
        <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
          <Bell className="w-5 h-5 text-amber-600" />
          Bloco D — Alarme
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Padrões crônicos detectados no log ou verificados manualmente. Marque as falhas não tratadas pelo monitoramento regular e detalhe as ocorrências.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {tags.map((tag) => {
            const isChecked = marcadas.includes(tag.id);
            return (
              <div
                key={tag.id}
                className={`p-4 sm:p-6 transition-colors hover:bg-muted/20 ${isChecked ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <Checkbox
                    id={tag.id}
                    checked={isChecked}
                    onCheckedChange={() => toggleTag(tag.id)}
                    className="mt-1 w-5 h-5 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                  />
                  <div className="flex-1 space-y-2">
                    <Label
                      htmlFor={tag.id}
                      className="text-sm sm:text-base font-semibold cursor-pointer flex flex-wrap items-center gap-2"
                    >
                      <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground font-mono">
                        {tag.codigo}
                      </span>
                      <span>{tag.nome}</span>
                      {tag.criticidade === "ALTA" && (
                        <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-1">
                          Alta
                        </span>
                      )}
                      {tag.criticidade === "MEDIA" && (
                        <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-1">
                          Média
                        </span>
                      )}
                      {tag.criticidade === "BAIXA" && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-1">
                          Baixa
                        </span>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                      {tag.criterio}
                    </p>
                    
                    {isChecked && (
                      <div className="mt-4 p-4 border border-dashed border-amber-200 bg-white dark:bg-black/20 rounded-md shadow-sm space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 font-medium">
                          <FileWarning className="w-4 h-4" />
                          Detalhar ocorrências
                        </div>
                        <div className="pt-1">
                          <textarea 
                            className="w-full text-sm min-h-[80px] p-3 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/50" 
                            placeholder="Descreva os disparos crônicos, as zonas envolvidas ou os detalhes que fundamentam este achado..."
                          />
                        </div>
                        {tag.exige_foto && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                            <Button variant="outline" size="sm" className="bg-background shadow-sm hover:bg-muted">
                              <Camera className="w-4 h-4 mr-2" />
                              Anexar Evidência
                            </Button>
                            <span className="text-xs text-muted-foreground">Evidência fotográfica obrigatória para este item.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {tags.length === 0 && (
            <div className="p-10 flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground">
              <Info className="w-8 h-8 opacity-40" />
              <p className="font-medium">Nenhuma etiqueta de Alarme (código A-*) foi encontrada.</p>
              <p className="text-xs">Sincronize o catálogo ou verifique se as tags foram criadas e ativadas no painel administrativo.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
