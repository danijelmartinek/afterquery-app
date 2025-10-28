"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAdminData } from "../../../../../providers/admin-data-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { Textarea } from "../../../../../components/ui/textarea";
import { Button } from "../../../../../components/ui/button";

export default function EmailSettingsPage() {
  const { state } = useAdminData();
  const [activeTemplate, setActiveTemplate] = useState(state.emailTemplates[0]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Email templates</h1>
        <p className="text-sm text-zinc-500">
          Templates sync with Resend and include variables documented in the architecture plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template library</CardTitle>
          <CardDescription>Switch between invite, reminder, and follow-up messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue={activeTemplate?.id}
            onValueChange={(value) => {
              const template = state.emailTemplates.find((item) => item.id === value);
              if (template) setActiveTemplate(template);
            }}
          >
            <TabsList className="flex w-full justify-start">
              {state.emailTemplates.map((template) => (
                <TabsTrigger key={template.id} value={template.id} className="flex-1">
                  {template.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {state.emailTemplates.map((template) => (
              <TabsContent key={template.id} value={template.id} className="mt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${template.id}-subject`}>Subject</Label>
                    <Input id={`${template.id}-subject`} defaultValue={template.subject} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last updated</Label>
                    <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                      {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor={`${template.id}-body`}>Body</Label>
                    <Textarea id={`${template.id}-body`} defaultValue={template.body} className="min-h-[200px]" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" type="button">
                    Reset changes
                  </Button>
                  <Button type="button">Save draft</Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
