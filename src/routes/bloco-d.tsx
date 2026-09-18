import { createFileRoute } from "@tanstack/react-router";
import { BlocoAlarme } from "@/components/auditoria/BlocoAlarme";
import { ArrowLeft, Save, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/bloco-d")({
  component: BlocoDPage,
});

function BlocoDPage() {
  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-background border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-foreground text-sm sm:text-base">Auditoria em Andamento — Ciclo Atual</h1>
            <p className="text-xs text-muted-foreground">Empresa Demonstração S.A.</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1 text-foreground">Pilar Condição</h2>
          <p className="text-sm text-muted-foreground">
            A pontuação deste pilar inicia em 100 e decai para cada divergência grave encontrada. 
            Os apontamentos de Alarme podem vir automaticamente do log ou serem validados manualmente nesta etapa.
          </p>
        </div>

        <BlocoAlarme />

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
          <Button variant="outline" className="w-full sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
            Avançar para Resumo
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </main>
    </div>
  );
}
