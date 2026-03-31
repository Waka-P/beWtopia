import type Stripe from "stripe";

type SessionUser = {
  id: number | string;
  email?: string | null;
  publicId?: string | null;
};

function toCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): Stripe.Customer | null {
  if (!customer || (customer as Stripe.DeletedCustomer).deleted) return null;
  return customer as Stripe.Customer;
}

function escapeStripeSearchValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function resolveStripeCustomer(
  stripe: Stripe,
  user: SessionUser,
): Promise<Stripe.Customer> {
  const publicId = user.publicId ?? undefined;
  const email = user.email ?? undefined;

  if (!publicId) {
    throw new Error("PUBLIC_ID_REQUIRED");
  }

  let customer: Stripe.Customer | null = null;

  try {
    const escaped = escapeStripeSearchValue(publicId);
    const searched = await stripe.customers.search({
      query: `metadata['publicId']:'${escaped}'`,
      limit: 1,
    });
    customer = toCustomer(searched.data[0]);
  } catch {
    customer = null;
  }

  if (!customer && email) {
    let startingAfter: string | undefined;
    while (true) {
      const list = await stripe.customers.list({
        email,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      customer =
        toCustomer(list.data.find((c) => c.metadata?.publicId === publicId)) ??
        null;
      if (customer) break;
      if (!list.has_more || list.data.length === 0) break;
      startingAfter = list.data[list.data.length - 1]?.id;
    }
  }

  if (!customer) {
    customer = await stripe.customers.create({
      email,
      metadata: {
        userId: String(user.id),
        publicId,
      },
    });
  } else {
    const nextMetadata: Record<string, string> = {
      ...(customer.metadata ?? {}),
      userId: String(user.id),
    };
    nextMetadata.publicId = publicId;

    const needsEmailUpdate = !!email && customer.email !== email;
    const needsPublicIdUpdate = customer.metadata?.publicId !== publicId;
    const needsUserIdUpdate = customer.metadata?.userId !== String(user.id);

    if (needsEmailUpdate || needsPublicIdUpdate || needsUserIdUpdate) {
      customer = await stripe.customers.update(customer.id, {
        ...(email ? { email } : {}),
        metadata: nextMetadata,
      });
    }
  }

  return customer;
}
