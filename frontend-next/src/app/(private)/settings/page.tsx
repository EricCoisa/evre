'use client';

import { Container } from "@/components/container";
import { useTranslation } from "@/hooks/use-translation";
import { SystemConfiguration } from "@/components/system-configuration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator";
import { UserSystemDefinitions } from "@/components/user-system-definitions"
import { useConfiguration } from "@/lib/actions/systemConfiguration/queries";
import { EmailProvider } from "@/lib/actions/systemConfiguration/types";
import { Fragment } from "react/jsx-runtime";
import { Button } from "@/components/ui/button";
import { validateConfiguration } from "@/lib/actions/email/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";


function SystemConfig({ t }: { t: (key: string) => string }) {

  return (
    <Container variant="form" padding>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('systemconfig_log_limite')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('systemconfig_log_limite_desc')}
          </p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEMCONFIG_LOG_LIMITE" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('systemconfig_log_delete_day')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('systemconfig_log_delete_day_desc')}
          </p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEMCONFIG_LOG_DELETE_DAY" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('systemconfig_suporturl')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('systemconfig_suporturl_desc')}
          </p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEMCONFIG_SUPORTURL" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('systemconfig_email_contact')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('systemconfig_email_contact_desc')}
          </p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEMCONFIG_CONTACT_EMAIL" />
      </div>

    </Container>
  )
}

function UserDefaultConfig({ t }: { t: (key: string) => string }) {

  return (
    <Container variant="form" padding>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('user_system_project_view_mode')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('user_system_project_view_mode_desc')}
          </p>
        </div>
        <UserSystemDefinitions disableLabel={true} labelKey="USERCONFIG_PROJECTVIEWMODE" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('user_system_definition_theme')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('user_system_definitions_theme_desc')}
          </p>
        </div>
        <UserSystemDefinitions disableLabel={true} labelKey="USERCONFIG_THEME" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('user_system_definition_language')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('user_system_definitions_language_desc')}
          </p>
        </div>
        <UserSystemDefinitions disableLabel={true} labelKey="USERCONFIG_LANGUAGE" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('user_system_definition_tour')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('user_system_definitions_tour_desc')}
          </p>
        </div>
        <UserSystemDefinitions showMessage={false} disableLabel={true} forceType="button" labelKey="USERTOUR" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('systemtour')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('systemtour_desc')}
          </p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEMTOUR" />
      </div>

      <Separator />
      <br />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('system_user_create')}</h3>
          <p className="text-muted-foreground text-sm">
            {t('system_user_create_desc')}
          </p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEM_USER_CREATE" />
      </div>
    </Container>
  )
}

function EmailConfig({ t }: { t: (key: string) => string }) {
  const { data, error, isLoading } = useConfiguration('SYSTEM_EMAIL_PROVIDER');
  const [valid, setValid] = useState(false);

  const handleValidate = () => {
    validateConfiguration().then((res) => {
      if (res.status) {
        toast.success(t('configuration_valid'))
        setValid(true)
      } else {
        toast.error(`${t('configuration_invalid')} - ${res.data}`)
        setValid(false)
      }
    })
  }

  return (
    <Container variant="form" padding>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('system_email_provider')}</h3>
          <p className="text-muted-foreground text-sm">{t('system_email_provider_desc')}</p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEM_EMAIL_PROVIDER" />
      </div>

      <Separator />
      <br />


      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{t('system_email_default_from')}</h3>
          <p className="text-muted-foreground text-sm">{t('system_email_default_from_desc')}</p>
        </div>
        <SystemConfiguration disableLabel={true} labelKey="SYSTEM_EMAIL_DEFAULT_FROM" />
      </div>

      {data?.value == EmailProvider.RESEND && (
        <>
          <Separator />
          <br />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('system_email_provider_api_key')}</h3>
              <p className="text-muted-foreground text-sm">{t('system_email_provider_api_key_desc')}</p>
            </div>
            <SystemConfiguration secret={true} disableLabel={true} labelKey="SYSTEM_EMAIL_PROVIDER_API_KEY" />
          </div>
        </>
      )
      }

      {data?.value == EmailProvider.SMTP && (
        <>

          <Separator />
          <br />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('system_email_smtp_host')}</h3>
              <p className="text-muted-foreground text-sm">{t('system_email_smtp_host_desc')}</p>
            </div>
            <SystemConfiguration disableLabel={true} labelKey="SYSTEM_EMAIL_SMTP_HOST" />
          </div>

          <Separator />
          <br />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('system_email_smtp_port')}</h3>
              <p className="text-muted-foreground text-sm">{t('system_email_smtp_port_desc')}</p>
            </div>
            <SystemConfiguration disableLabel={true} labelKey="SYSTEM_EMAIL_SMTP_PORT" />
          </div>

          <Separator />
          <br />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('system_email_smtp_user')}</h3>
              <p className="text-muted-foreground text-sm">{t('system_email_smtp_user_desc')}</p>
            </div>
            <SystemConfiguration disableLabel={true} labelKey="SYSTEM_EMAIL_SMTP_USER" />
          </div>

          <Separator />
          <br />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('system_email_smtp_pass')}</h3>
              <p className="text-muted-foreground text-sm">{t('system_email_smtp_pass_desc')}</p>
            </div>
            <SystemConfiguration secret={true} disableLabel={true} labelKey="SYSTEM_EMAIL_SMTP_PASS" />
          </div>

          <Separator />
          <br />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('system_email_smtp_secure')}</h3>
              <p className="text-muted-foreground text-sm">{t('system_email_smtp_secure_desc')}</p>
            </div>
            <SystemConfiguration forceType="button" secret disableLabel={true} labelKey="SYSTEM_EMAIL_SMTP_SECURE" />
          </div>
        </>
      )}

      <br />
      <Button onClick={handleValidate}>{t('validate_configuration')}</Button>

    </Container >
  )
}

export default function SettingsPage() {
  const { t } = useTranslation('settings');

  return (
    <Container variant="form" border={false}>
      <Tabs defaultValue="systemConfig">
        <TabsList>
          <TabsTrigger value="systemConfig">{t('systemConfiguration')}</TabsTrigger>
          <TabsTrigger value="userConfig">{t('userConfiguration')}</TabsTrigger>
          <TabsTrigger value="emailConfig">{t('emailConfiguration')}</TabsTrigger>
        </TabsList>
        <TabsContent value="systemConfig"><SystemConfig t={t} /></TabsContent>
        <TabsContent value="userConfig"><UserDefaultConfig t={t} /></TabsContent>
        <TabsContent value="emailConfig"><EmailConfig t={t} /></TabsContent>
      </Tabs>
    </Container>
  )
}